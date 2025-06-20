import { registerMembershipSubscription } from "../../models/membership.server";
import { getUser } from "~/utils/session.server";

export async function action({ request } : { request: Request }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { currentMembershipId, newMembershipPlanId, userId } = body;

    if (!currentMembershipId || !newMembershipPlanId || !userId) {
      return new Response(JSON.stringify({ error: "Missing required downgrade data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process the downgrade directly with no payment needed
    await registerMembershipSubscription(
      parseInt(userId),
      parseInt(newMembershipPlanId),
      parseInt(currentMembershipId),
      true // Flag to indicate this is a downgrade
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Downgrade action error:", error);
    return new Response(JSON.stringify({ error: "Internal server error"}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}