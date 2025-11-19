import { logger } from "~/logging/logger";
import {
  registerMembershipSubscription,
  getMembershipPlanById,
  getUserActiveMembership,
  calculateProratedUpgradeAmount,
  activateMembershipForm,
  MEMBERSHIP_REVOKED_ERROR,
} from "../../models/membership.server";
import { getUser } from "~/utils/session.server";

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
    const {
      currentMembershipId,
      newMembershipPlanId,
      userId,
      billingCycle = "monthly",
    }: {
      currentMembershipId: string;
      newMembershipPlanId: string;
      userId: string;
      billingCycle?: "monthly" | "quarterly" | "semiannually" | "yearly";
    } = body;

    if (!currentMembershipId || !newMembershipPlanId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required upgrade data" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify active membership and monthly→monthly
    const currentActive = await getUserActiveMembership(parseInt(userId));
    if (!currentActive) {
      return new Response(
        JSON.stringify({ error: "No active membership to upgrade" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      currentActive.billingCycle !== "monthly" ||
      billingCycle !== "monthly"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Only monthly-to-monthly upgrades are supported without payment.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const newPlan = await getMembershipPlanById(parseInt(newMembershipPlanId));
    if (!newPlan) {
      return new Response(
        JSON.stringify({ error: "New plan not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const fee = calculateProratedUpgradeAmount(
      new Date(),
      new Date(currentActive.nextPaymentDate),
      Number(currentActive.membershipPlan.price),
      Number(newPlan.price)
    );

    if (fee > 0) {
      return new Response(
        JSON.stringify({
          error: "Payment required for this upgrade",
          upgradeFee: fee,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let subscription;
    try {
      subscription = await registerMembershipSubscription(
        parseInt(userId),
        parseInt(newMembershipPlanId),
        parseInt(currentMembershipId),
        false,
        false,
        undefined,
        "monthly"
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === MEMBERSHIP_REVOKED_ERROR
      ) {
        return new Response(
          JSON.stringify({
            error:
              "User membership access is revoked. Upgrades cannot be processed.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    // Activate pending form and link it to new subscription
    try {
      await activateMembershipForm(
        parseInt(userId),
        parseInt(newMembershipPlanId),
        subscription.id
      );
    } catch {}

    try {
      const plan = await getMembershipPlanById(parseInt(newMembershipPlanId));
      logger.info(
        `Membership upgraded without payment for user ${userId} to ${plan?.title}`
      );
    } catch {}

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(`Zero-cost upgrade error: ${error}`, { url: request.url });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


