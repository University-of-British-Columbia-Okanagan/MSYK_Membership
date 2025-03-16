import { Stripe } from "stripe";
import { getWorkshopById, getWorkshopOccurrence } from "../models/workshop.server";
import { getMembershipPlanById } from "../models/membership.server"; // new import

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Fix JSON Parsing: Handle both JSON & FormData requests
export async function createCheckoutSession(request: Request) {
  try {
    let body;
    const contentType = request.headers.get("Content-Type");

    if (contentType?.includes("application/json")) {
      body = await request.json(); 
    } else {
      const formData = await request.formData(); 
      body = {
        workshopId: Number(formData.get("workshopId")),
        occurrenceId: Number(formData.get("occurrenceId")),
        price: Number(formData.get("price")),
        userId: Number(formData.get("userId")),
        membershipPlanId: formData.get("membershipPlanId"),
      };
    }

    // If a membershipPlanId is provided, process membership payment
    if (body.membershipPlanId) {
      const membershipPlanId = Number(body.membershipPlanId);
      if (!membershipPlanId || !body.price || !body.userId) {
        return new Response(
          JSON.stringify({ error: "Missing required membership payment data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const membershipPlan = await getMembershipPlanById(membershipPlanId);
      if (!membershipPlan) {
        return new Response(
          JSON.stringify({ error: "Membership Plan not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create Stripe Checkout Session for membership
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: membershipPlan.title,
                description: membershipPlan.description,
              },
              unit_amount: Math.round(Number(body.price) * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5173/dashboard/memberships`,
        metadata: {
          membershipPlanId: membershipPlanId.toString(),
          userId: Number(body.userId).toString(),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate Inputs for workshop registration
    const { workshopId, occurrenceId, price, userId } = body;
    if (!workshopId || !occurrenceId || !price || !userId) {
      return new Response(JSON.stringify({ error: "Missing required payment data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch Workshop & Occurrence
    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!workshop || !occurrence) {
      return new Response(JSON.stringify({ error: "Workshop or Occurrence not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create Stripe Checkout Session for workshop registration
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: workshop.name,
              description: `Occurrence on ${new Date(occurrence.startDate).toLocaleString()}`,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/workshops`,
      metadata: {
        workshopId: workshopId.toString(),
        occurrenceId: occurrenceId.toString(),
        userId: userId.toString(),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
