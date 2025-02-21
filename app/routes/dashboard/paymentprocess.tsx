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

    return createCheckoutSession(request); // ✅ Pass entire request
  } catch (error) {
    console.error("Payment action error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
