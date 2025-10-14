import { logger } from "~/logging/logger";
import {
  registerMembershipSubscription,
  getMembershipPlanById,
} from "../../models/membership.server";
import { sendMembershipResubscribeEmail } from "~/utils/email.server";
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
    const { currentMembershipId, membershipPlanId, userId } = body;

    try {
      let billingCycle: "monthly" | "quarterly" | "6months" | "yearly" =
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
            | "6months"
            | "yearly";
        }
      }

      console.log("Retrieved billingCycle from DB:", billingCycle);
      await registerMembershipSubscription(
        userId,
        membershipPlanId,
        currentMembershipId,
        false, // Not a downgrade
        true, // Flag this as a resubscription
        undefined,
        billingCycle
      );
      logger.info(
        `Membership Subscription Registered successfully for user ${userId}`,
        { url: request.url }
      );

      try {
        const plan = await getMembershipPlanById(membershipPlanId);
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        await sendMembershipResubscribeEmail({
          userEmail: user.email!,
          planTitle: plan?.title || "Membership",
          monthlyPrice: plan?.price,
          billingCycle,
          planPrice:
            billingCycle === "quarterly"
              ? plan?.price3Months ?? plan?.price
              : billingCycle === "6months"
              ? plan?.price6Months ?? plan?.price
              : billingCycle === "yearly"
              ? plan?.priceYearly ?? plan?.price
              : plan?.price,
          nextBillingDate: billingCycle === "monthly" ? nextBillingDate : undefined,
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
