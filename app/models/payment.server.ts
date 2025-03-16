import { Stripe } from "stripe";
import { getWorkshopById, getWorkshopOccurrence, getWorkshopOccurrencesByConnectId } from "./workshop.server";
import { getMembershipPlanById } from "./membership.server";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function createCheckoutSession(request: Request) {
  const body = await request.json();

  // Membership Payment Branch (unchanged)
  if (body.membershipPlanId) {
    const { membershipPlanId, price, userId } = body;
    if (!membershipPlanId || !price || !userId) {
      throw new Error("Missing required membership payment data");
    }
    const membershipPlan = await getMembershipPlanById(Number(membershipPlanId));
    if (!membershipPlan) {
      throw new Error("Membership Plan not found");
    }
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
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: body.userEmail, // pass the user email in your request
      success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/memberships`,
      metadata: {
        membershipPlanId: membershipPlanId.toString(),
        userId: userId.toString(),
      },
    });
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Workshop Payment with Single Occurrence
  else if (body.workshopId && body.occurrenceId) {
    const { workshopId, occurrenceId, price, userId } = body;
    if (!workshopId || !occurrenceId || !price || !userId) {
      throw new Error("Missing required payment data");
    }
    const workshop = await getWorkshopById(Number(workshopId));
    const occurrence = await getWorkshopOccurrence(Number(workshopId), Number(occurrenceId));
    if (!workshop || !occurrence) {
      throw new Error("Workshop or Occurrence not found");
    }
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
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: body.userEmail,
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
  }
  // Workshop Payment for Continuation (using connectId)
  else if (body.workshopId && body.connectId) {
    const { workshopId, connectId, price, userId } = body;
    if (!workshopId || !connectId || !price || !userId) {
      throw new Error("Missing required payment data");
    }
    const workshop = await getWorkshopById(Number(workshopId));
    const occurrences = await getWorkshopOccurrencesByConnectId(
      Number(workshopId),
      Number(connectId)
    );
    if (!workshop || !occurrences || occurrences.length === 0) {
      throw new Error("Workshop or Occurrences not found");
    }
  
    // Build a multiline description listing all occurrences
    // Example format:
    // Occurrences:
    //   3/18/2025, 2:00:00 AM - 3/18/2025, 3:00:00 AM
    //   3/19/2025, 2:15:00 AM - 3/19/2025, 3:15:00 AM
    const occurrencesDescription = occurrences
      .map((occ) => {
        const startStr = new Date(occ.startDate).toLocaleString();
        const endStr = new Date(occ.endDate).toLocaleString();
        return `  ${startStr} - ${endStr}`;
      })
      .join("\n");
  
    const description = `Occurrences:\n${occurrencesDescription}`;
  
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: workshop.name,
              description, // Use the multiline string as the description
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: body.userEmail, // Or however you're passing user email
      success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/workshops`,
      metadata: {
        workshopId: workshopId.toString(),
        connectId: connectId.toString(),
        userId: userId.toString(),
      },
    });
  
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    throw new Error("Missing required payment parameters");
  }
}
