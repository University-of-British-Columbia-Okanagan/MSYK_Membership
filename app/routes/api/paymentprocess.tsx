import { logger } from "~/logging/logger";
import { createCheckoutSession } from "../../models/payment.server";
import { getUser } from "~/utils/session.server";

export async function action({ request }) {
  try {
    const user = await getUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return createCheckoutSession(request);
  } catch (error) {
    logger.error(`Payment action error: ${error}`, { url: request.url });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
