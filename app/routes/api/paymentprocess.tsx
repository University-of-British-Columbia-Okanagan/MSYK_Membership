import { logger } from "~/logging/logger";
import { createCheckoutSession } from "../../models/payment.server";
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

    // Who pays is always the session user; any userId in the body is ignored.
    return await createCheckoutSession(request, user.id);
  } catch (error) {
    logger.error(`Payment action error: ${error}`, { url: request.url });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
