import { logger } from "~/logging/logger";
import { registerMembershipSubscription } from "../../models/membership.server";
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
    const { currentMembershipId, membershipPlanId, userId } = body;

    try {
      await registerMembershipSubscription(
        userId,
        membershipPlanId,
        currentMembershipId,
        false, // Not a downgrade
        true // Flag this as a resubscription
      );
      logger.info(`Membership Subscription Registered successfully for user ${userId}`, {url: request.url,})

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logger.error(`Resubscription error: ${error}`, {url: request.url,});
      return new Response(JSON.stringify({ success: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    logger.error(`Downgrade action error: ${error}`, {url: request.url,});
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
