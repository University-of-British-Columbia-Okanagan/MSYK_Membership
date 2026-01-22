import { logger } from "~/logging/logger";
import {
  registerMembershipSubscription,
  getMembershipPlanById,
  MEMBERSHIP_REVOKED_ERROR,
} from "../../models/membership.server";
import { sendMembershipResubscribeEmail, checkPaymentMethodStatus } from "~/utils/email.server";
import { getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export async function action({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { currentMembershipId, membershipPlanId, userId, autoRenew } = body;
    const shouldAutoRenew =
      typeof autoRenew === "boolean"
        ? autoRenew
        : autoRenew === "false" || autoRenew === "0"
          ? false
          : true;

    try {
      let billingCycle: "monthly" | "quarterly" | "semiannually" | "yearly" =
        "monthly";

      if (currentMembershipId) {
        const cancelledMembership = await db.userMembership.findUnique({
          where: { id: parseInt(currentMembershipId) },
          select: { billingCycle: true },
        });

        if (cancelledMembership?.billingCycle) {
          billingCycle = cancelledMembership.billingCycle as
            | "monthly"
            | "quarterly"
            | "semiannually"
            | "yearly";
        }
      }

      console.log("Retrieved billingCycle from DB:", billingCycle);
      try {
        await registerMembershipSubscription(
          userId,
          membershipPlanId,
          currentMembershipId,
          false, // Not a downgrade
          true, // Flag this as a resubscription
          undefined,
          billingCycle,
          shouldAutoRenew
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === MEMBERSHIP_REVOKED_ERROR
        ) {
          return new Response(
            JSON.stringify({
              error:
                "User membership access is revoked. Resubscription is not allowed.",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        throw error;
      }
      logger.info(
        `Membership Subscription Registered successfully for user ${userId}`,
        { url: request.url }
      );

      try {
        const plan = await getMembershipPlanById(membershipPlanId);
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const needsPaymentMethod = await checkPaymentMethodStatus(parseInt(userId));
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
          nextBillingDate: billingCycle === "monthly" ? nextBillingDate : undefined,
          needsPaymentMethod,
        });
      } catch {
        // non-blocking
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logger.error(`Resubscription error: ${error}`, { url: request.url });
      return new Response(JSON.stringify({ success: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    logger.error(`Downgrade action error: ${error}`, { url: request.url });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
