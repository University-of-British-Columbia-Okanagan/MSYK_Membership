import { logger } from "~/logging/logger";
import {
  registerMembershipSubscription,
  getMembershipPlanById,
  getOwnedMembership,
  MembershipChangeError,
  MEMBERSHIP_REVOKED_ERROR,
} from "../../models/membership.server";
import { sendMembershipResubscribeEmail, checkPaymentMethodStatus } from "~/utils/email.server";
import { getUser } from "~/utils/session.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Reactivates the signed-in member's own cancelled membership, free, on its paid-up term. */
export async function action({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const { currentMembershipId, membershipPlanId, autoRenew } = body;
    const shouldAutoRenew =
      typeof autoRenew === "boolean"
        ? autoRenew
        : autoRenew === "false" || autoRenew === "0"
          ? false
          : true;

    if (!currentMembershipId || !membershipPlanId) {
      return json({ success: false, error: "Missing required resubscription data" }, 400);
    }

    let subscription: { nextPaymentDate?: Date | null } | undefined;
    let billingCycle: "monthly" | "quarterly" | "semiannually" | "yearly";
    try {
      const cancelled = await getOwnedMembership(user.id, Number(currentMembershipId), "cancelled");
      billingCycle = cancelled.billingCycle as typeof billingCycle;

      subscription = await registerMembershipSubscription(
        user.id,
        Number(membershipPlanId),
        cancelled.id,
        false, // Not a downgrade
        true, // Flag this as a resubscription
        undefined,
        billingCycle,
        shouldAutoRenew
      );
    } catch (error) {
      if (error instanceof MembershipChangeError) {
        return json({ success: false, error: error.message }, 400);
      }
      if (error instanceof Error && error.message === MEMBERSHIP_REVOKED_ERROR) {
        return json(
          { error: "User membership access is revoked. Resubscription is not allowed." },
          403
        );
      }
      logger.error(`Resubscription error: ${error}`, { url: request.url });
      return json({ success: false });
    }
    logger.info(`Membership Subscription Registered successfully for user ${user.id}`, {
      url: request.url,
    });

    try {
      const plan = await getMembershipPlanById(Number(membershipPlanId));
      const needsPaymentMethod = await checkPaymentMethodStatus(user.id);
      await sendMembershipResubscribeEmail({
        userEmail: user.email!,
        planTitle: plan?.title || "Membership",
        monthlyPrice: plan?.price,
        billingCycle,
        planPrice:
          billingCycle === "quarterly"
            ? plan?.price3Months ?? plan?.price
            : billingCycle === "semiannually"
            ? plan?.price6Months ?? plan?.price
            : billingCycle === "yearly"
            ? plan?.priceYearly ?? plan?.price
            : plan?.price,
        // Quote what was saved rather than recomputing it for one cycle.
        nextBillingDate: subscription?.nextPaymentDate ?? undefined,
        needsPaymentMethod,
        autoRenew: shouldAutoRenew,
      });
    } catch {
      // non-blocking
    }

    return json({ success: true });
  } catch (error) {
    logger.error(`Resubscribe action error: ${error}`, { url: request.url });
    return json({ error: "Internal server error" }, 500);
  }
}
