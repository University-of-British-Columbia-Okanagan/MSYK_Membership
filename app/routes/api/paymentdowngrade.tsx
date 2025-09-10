import { logger } from "~/logging/logger";
import { getMembershipPlanById, getUserActiveMembership, registerMembershipSubscription } from "../../models/membership.server";
import { sendMembershipDowngradeEmail } from "~/utils/email.server";
import { getUser } from "~/utils/session.server";

export async function action({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    if (!user) {
      logger.warn(`User Unauthorized`, { url: request.url });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { currentMembershipId, newMembershipPlanId, userId } = body;

    if (!currentMembershipId || !newMembershipPlanId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required downgrade data" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Process the downgrade directly with no payment needed
    await registerMembershipSubscription(
      parseInt(userId),
      parseInt(newMembershipPlanId),
      parseInt(currentMembershipId),
      true // Flag to indicate this is a downgrade
    );

    try {
      const newPlan = await getMembershipPlanById(parseInt(newMembershipPlanId));
      const currentActive = await getUserActiveMembership(parseInt(userId));
      await sendMembershipDowngradeEmail({
        userEmail: user.email!,
        currentPlanTitle: currentActive?.membershipPlan?.title || "Current Plan",
        newPlanTitle: newPlan?.title || "New Plan",
        currentMonthlyPrice: currentActive?.membershipPlan?.price,
        newMonthlyPrice: newPlan?.price,
        // Effective on the next payment date for the current membership if available
        effectiveDate: currentActive?.nextPaymentDate || new Date(new Date().setMonth(new Date().getMonth() + 1)),
      });
    } catch (e) {
      // Non-blocking
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(`Downgrade action error: ${error}`, { url: request.url });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
