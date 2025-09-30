import { logger } from "~/logging/logger";
import {
  registerMembershipSubscription,
  getMembershipPlanById,
} from "../../models/membership.server";
import { sendMembershipResubscribeEmail } from "~/utils/email.server";
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
      membershipPlanId,
      userId,
      billingCycle = "monthly",
    } = body;

    try {
      await registerMembershipSubscription(
        userId,
        membershipPlanId,
        currentMembershipId,
        false, // Not a downgrade
        true, // Flag this as a resubscription
        undefined,
        billingCycle as "monthly" | "6months" | "yearly"
      );
      logger.info(
        `Membership Subscription Registered successfully for user ${userId}`,
        { url: request.url }
      );

      try {
        const plan = await getMembershipPlanById(membershipPlanId);
        const nextBillingDate = new Date();
        if (billingCycle === "6months") {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 6);
        } else if (billingCycle === "yearly") {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }
        console.log("Next Billing Date:", nextBillingDate);
        await sendMembershipResubscribeEmail({
          userEmail: user.email!,
          planTitle: plan?.title || "Membership",
          monthlyPrice: plan?.price,
          nextBillingDate,
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
