import { Stripe } from "stripe";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
} from "./workshop.server";
import { getMembershipPlanById } from "./membership.server";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function createCheckoutSession(request: Request) {
  const body = await request.json();

  // Membership Payment Branch
  if (body.membershipPlanId) {
    const { membershipPlanId, price, userId, compensationPrice, oldMembershipNextPaymentDate, userEmail } = body; // <--- Note we read compensationPrice here
    if (!membershipPlanId || !price || !userId) {
      throw new Error("Missing required membership payment data");
    }
    const membershipPlan = await getMembershipPlanById(Number(membershipPlanId));
    if (!membershipPlan) {
      throw new Error("Membership Plan not found");
    }

    let finalDescription = membershipPlan.description || "";
    if (compensationPrice && compensationPrice > 0) {
      finalDescription += `\nPay now: $${compensationPrice.toFixed(
        2
      )}. $${membershipPlan.price.toFixed(2)} starting ${oldMembershipNextPaymentDate
        ? new Date(
            oldMembershipNextPaymentDate
          ).toLocaleDateString()
        : "N/A"}.` ;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
      },    
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: membershipPlan.title,
              description: finalDescription,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/memberships`,
      metadata: {
        membershipPlanId: membershipPlanId.toString(),
        userId: userId.toString(),
        compensationPrice: compensationPrice ? compensationPrice.toString() : "0",
        originalPrice: membershipPlan.price.toString(),
        currentMembershipId: body.currentMembershipId ? body.currentMembershipId.toString() : null,
      },
    });
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Workshop Single Occurrence Payment
  else if (body.workshopId && body.occurrenceId) {
    const { workshopId, occurrenceId, price, userId, userEmail } = body;
    if (!workshopId || !occurrenceId || !price || !userId) {
      throw new Error("Missing required payment data");
    }
    const workshop = await getWorkshopById(Number(workshopId));
    const occurrence = await getWorkshopOccurrence(
      Number(workshopId),
      Number(occurrenceId)
    );
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
              description: `Occurrence on ${new Date(
                occurrence.startDate
              ).toLocaleString()}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail,
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
  // Workshop Continuation Payment
  else if (body.workshopId && body.connectId) {
    const { workshopId, connectId, price, userId, userEmail } = body;
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

    const occurrencesDescription = occurrences
      .map((occ) => {
        const startStr = new Date(occ.startDate).toLocaleString();
        const endStr = new Date(occ.endDate).toLocaleString();
        return `  ${startStr} - ${endStr}`;
      })
      .join("\n");

    const description = `Occurrences:\n${occurrencesDescription}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: workshop.name,
              description,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail,
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
  }
  // Equipment Booking Payment (NEW BRANCH)
  else if (body.equipmentId && body.slotCount && body.price && body.userId && body.slotsDataKey) {
    const { equipmentId, slotCount, price, userId, slots, userEmail, slotsDataKey } = body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Equipment Booking (ID: ${equipmentId})`,
              description: `Booking for ${slotCount} slots`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/equipment`,
      metadata: {
        equipmentId: equipmentId.toString(),
        userId: userId.toString(),
        slotCount: slotCount.toString(),
        slotsDataKey: slotsDataKey,
        isEquipmentBooking: "true",
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
