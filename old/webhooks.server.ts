import Stripe from "stripe";
import { db } from "../app/utils/db.server";
import { json } from "react-router";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export async function loader({ request }) {
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return json({ error: "No signature found" }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = parseInt(session.metadata?.userId || "0");
    const occurrenceId = parseInt(session.metadata?.occurrenceId || "0");

    if (!userId || !occurrenceId) {
      console.error("Invalid metadata in Stripe session.");
      return json({ error: "Invalid metadata" }, { status: 400 });
    }

    try {
      // Confirm registration
      await db.userWorkshop.create({
        data: {
          userId,
          workshopId: occurrenceId,
          occurrenceId,
        },
      });

      console.log("Registration successful for:", userId, occurrenceId);
    } catch (error) {
      console.error("Database error:", error);
    }
  }

  return json({ received: true });
}
