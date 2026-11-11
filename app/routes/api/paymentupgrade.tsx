import { logger } from "~/logging/logger";
import {
  registerMembershipSubscription,
  getMembershipPlanById,
  getOwnedMembership,
  calculateProratedUpgradeAmount,
  activateMembershipForm,
  MembershipChangeError,
  MEMBERSHIP_REVOKED_ERROR,
} from "../../models/membership.server";
import { getUser } from "~/utils/session.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Switches the signed-in member's active monthly plan when no payment is due. */
export async function action({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    if (!user) {
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
      return json({ error: "Missing required upgrade data" }, 400);
    }

    try {
      const current = await getOwnedMembership(user.id, Number(currentMembershipId), "active");

      if (current.billingCycle !== "monthly" || billingCycle !== "monthly") {
        return json(
          { error: "Only monthly-to-monthly upgrades are supported without payment." },
          400
        );
      }

      const newPlan = await getMembershipPlanById(Number(newMembershipPlanId));
      if (!newPlan) {
        return json({ error: "New plan not found" }, 404);
      }
      if (newPlan.id === current.membershipPlanId) {
        return json({ error: "You are already on this plan." }, 400);
      }
      // The payment page sends a cheaper plan to the downgrade route; this one would
      // switch immediately instead of at the end of the paid month.
      if (Number(newPlan.price) < Number(current.membershipPlan.price)) {
        return json(
          { error: "That plan is cheaper than your current plan. Please choose it as a downgrade." },
          400
        );
      }

      const fee = calculateProratedUpgradeAmount(
        new Date(),
        new Date(current.nextPaymentDate),
        Number(current.membershipPlan.price),
        Number(newPlan.price)
      );
      if (fee > 0) {
        return json({ error: "Payment required for this upgrade", upgradeFee: fee }, 400);
      }

      const subscription = await registerMembershipSubscription(
        user.id,
        newPlan.id,
        current.id,
        false,
        false,
        undefined,
        "monthly",
        shouldAutoRenew
      );

      try {
        await activateMembershipForm(user.id, newPlan.id, subscription.id);
      } catch {}

      logger.info(`Membership upgraded without payment for user ${user.id} to ${newPlan.title}`);
      return json({ success: true });
    } catch (error) {
      if (error instanceof MembershipChangeError) {
        return json({ error: error.message }, 400);
      }
      if (error instanceof Error && error.message === MEMBERSHIP_REVOKED_ERROR) {
        return json(
          { error: "User membership access is revoked. Upgrades cannot be processed." },
          403
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Zero-cost upgrade error: ${error}`, { url: request.url });
    return json({ error: "Internal server error" }, 500);
  }
}
