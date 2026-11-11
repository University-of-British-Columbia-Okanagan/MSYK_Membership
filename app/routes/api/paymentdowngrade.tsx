import { logger } from "~/logging/logger";
import {
  getMembershipPlanById,
  getOwnedMembership,
  registerMembershipSubscription,
  MembershipChangeError,
  MEMBERSHIP_REVOKED_ERROR,
} from "../../models/membership.server";
import { sendMembershipDowngradeEmail, checkPaymentMethodStatus } from "~/utils/email.server";
import { getUser } from "~/utils/session.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Schedules a cheaper monthly plan for the signed-in member from their next payment date. */
export async function action({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    if (!user) {
      logger.warn(`User Unauthorized`, { url: request.url });
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const { currentMembershipId, newMembershipPlanId, billingCycle = "monthly", autoRenew } = body;
    const shouldAutoRenew =
      typeof autoRenew === "boolean"
        ? autoRenew
        : autoRenew === "false" || autoRenew === "0"
          ? false
          : true;

    if (!currentMembershipId || !newMembershipPlanId) {
      return json({ error: "Missing required downgrade data" }, 400);
    }

    let current;
    let newPlan;
    try {
      current = await getOwnedMembership(user.id, Number(currentMembershipId), "active");

      if (current.billingCycle !== "monthly" || billingCycle !== "monthly") {
        return json(
          {
            error:
              "Only monthly-to-monthly downgrades are supported. Please cancel your current term and wait for it to end.",
          },
          400
        );
      }

      newPlan = await getMembershipPlanById(Number(newMembershipPlanId));
      if (!newPlan) {
        return json({ error: "New plan not found" }, 404);
      }
      // The payment page calls a plan a downgrade when its monthly price is lower.
      if (!(Number(newPlan.price) < Number(current.membershipPlan.price))) {
        return json(
          {
            error:
              "That plan is not cheaper than your current plan, so it cannot be scheduled as a downgrade.",
          },
          400
        );
      }

      await registerMembershipSubscription(
        user.id,
        newPlan.id,
        current.id,
        true, // Flag to indicate this is a downgrade
        false, // Not a resubscription
        undefined, // No payment intent
        "monthly",
        shouldAutoRenew
      );
    } catch (error) {
      if (error instanceof MembershipChangeError) {
        return json({ error: error.message }, 400);
      }
      if (error instanceof Error && error.message === MEMBERSHIP_REVOKED_ERROR) {
        return json(
          { error: "User membership access is revoked. Downgrades cannot be processed." },
          403
        );
      }
      throw error;
    }

    try {
      const needsPaymentMethod = await checkPaymentMethodStatus(user.id);
      await sendMembershipDowngradeEmail({
        userEmail: user.email!,
        currentPlanTitle: current.membershipPlan?.title || "Current Plan",
        newPlanTitle: newPlan.title || "New Plan",
        currentMonthlyPrice: current.membershipPlan?.price,
        newMonthlyPrice: newPlan.price,
        // Effective on the next payment date for the current membership
        effectiveDate: current.nextPaymentDate || new Date(),
        needsPaymentMethod,
      });
    } catch (e) {
      // Non-blocking
    }

    return json({ success: true });
  } catch (error) {
    logger.error(`Downgrade action error: ${error}`, { url: request.url });
    return json({ error: "Internal server error" }, 500);
  }
}
