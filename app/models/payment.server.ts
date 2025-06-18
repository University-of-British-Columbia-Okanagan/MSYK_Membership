import { Stripe } from "stripe";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
} from "./workshop.server";
import { getMembershipPlanById } from "./membership.server";
import { getSavedPaymentMethod } from "./user.server";
import { db } from "../utils/db.server";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function createPaymentIntentWithSavedCard(
  userId: number,
  amount: number,
  description: string,
  metadata: Record<string, string>
) {
  // Get user's saved payment method
  const savedPayment = await getSavedPaymentMethod(userId);
  if (
    !savedPayment ||
    !savedPayment.stripePaymentMethodId ||
    !savedPayment.stripeCustomerId
  ) {
    throw new Error("No saved payment method found");
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: "usd",
    customer: savedPayment.stripeCustomerId,
    payment_method: savedPayment.stripePaymentMethodId,
    description,
    metadata,
    confirm: true, // Automatically confirm the payment
    off_session: true, // Payment is being made without customer present
    payment_method_types: ["card"],
  });

  return paymentIntent;
}

// Function to handle quick checkout for workshops
export async function quickCheckoutWorkshop(
  userId: number,
  workshopId: number,
  occurrenceId?: number,
  connectId?: number
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) throw new Error("User not found");

  const workshop = await getWorkshopById(workshopId);
  if (!workshop) throw new Error("Workshop not found");

  let description = workshop.name;
  let metadata: Record<string, string> = {
    userId: userId.toString(),
    workshopId: workshopId.toString(),
  };

  if (occurrenceId) {
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!occurrence) throw new Error("Occurrence not found");
    description += ` - ${new Date(occurrence.startDate).toLocaleString()}`;
    metadata.occurrenceId = occurrenceId.toString();
  } else if (connectId) {
    const occurrences = await getWorkshopOccurrencesByConnectId(
      workshopId,
      connectId
    );
    if (!occurrences || occurrences.length === 0)
      throw new Error("Occurrences not found");
    description += ` - ${occurrences.length} sessions`;
    metadata.connectId = connectId.toString();
  }

  try {
    const paymentIntent = await createPaymentIntentWithSavedCard(
      userId,
      workshop.price,
      description,
      metadata
    );

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      amount: workshop.price,
    };
  } catch (error: any) {
    // If payment requires authentication, return the client secret
    if (error.raw?.payment_intent) {
      return {
        success: false,
        requiresAction: true,
        clientSecret: error.raw.payment_intent.client_secret,
        paymentIntentId: error.raw.payment_intent.id,
      };
    }
    throw error;
  }
}

export async function deletePaymentMethod(userId: number) {
  try {
    const savedPayment = await db.userPaymentInformation.findUnique({
      where: { userId },
    });

    if (savedPayment?.stripePaymentMethodId) {
      // Detach the payment method from Stripe
      await stripe.paymentMethods.detach(savedPayment.stripePaymentMethodId);
    }

    // Remove from database
    await db.userPaymentInformation.deleteMany({
      where: { userId },
    });

    return { success: true, deleted: true };
  } catch (error: any) {
    console.error("Failed to delete payment method:", error);
    throw new Error("Failed to delete payment method. Please try again.");
  }
}

export async function createOrUpdatePaymentMethod(
  userId: number,
  data: {
    cardholderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvc: string;
    billingAddressLine1: string;
    billingAddressLine2: string | null;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingCountry: string;
    email: string;
  }
) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { paymentInformation: true },
    });

    if (!user) throw new Error("User not found");

    let stripeCustomerId = user.paymentInformation?.stripeCustomerId;

    // Create or retrieve Stripe customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: data.email,
        name: data.cardholderName,
        address: {
          line1: data.billingAddressLine1,
          line2: data.billingAddressLine2 || undefined,
          city: data.billingCity,
          state: data.billingState,
          postal_code: data.billingZip,
          country: data.billingCountry,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Create a payment method using test token (for production, use Stripe.js on frontend)
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: "tok_visa", // This is a test token - in production, get token from Stripe.js
      },
      billing_details: {
        name: data.cardholderName,
        email: data.email,
        address: {
          line1: data.billingAddressLine1,
          line2: data.billingAddressLine2 || undefined,
          city: data.billingCity,
          state: data.billingState,
          postal_code: data.billingZip,
          country: data.billingCountry,
        },
      },
    });

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    // Save to database
    await db.userPaymentInformation.upsert({
      where: { userId },
      update: {
        stripeCustomerId,
        stripePaymentMethodId: paymentMethod.id,
        cardholderName: data.cardholderName,
        cardLast4: paymentMethod.card?.last4 || data.cardNumber.slice(-4),
        cardExpiry: `${data.expiryMonth}/${data.expiryYear.slice(-2)}`,
        expMonth: parseInt(data.expiryMonth),
        expYear: parseInt(data.expiryYear),
        billingAddressLine1: data.billingAddressLine1,
        billingAddressLine2: data.billingAddressLine2,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingZip: data.billingZip,
        billingCountry: data.billingCountry,
        email: data.email,
        isDefault: true,
      },
      create: {
        userId,
        stripeCustomerId,
        stripePaymentMethodId: paymentMethod.id,
        cardholderName: data.cardholderName,
        cardLast4: paymentMethod.card?.last4 || data.cardNumber.slice(-4),
        cardExpiry: `${data.expiryMonth}/${data.expiryYear.slice(-2)}`,
        expMonth: parseInt(data.expiryMonth),
        expYear: parseInt(data.expiryYear),
        billingAddressLine1: data.billingAddressLine1,
        billingAddressLine2: data.billingAddressLine2,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingZip: data.billingZip,
        billingCountry: data.billingCountry,
        email: data.email,
        isDefault: true,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to save payment method:", error);
    throw new Error(
      error.message || "Failed to save payment method. Please try again."
    );
  }
}

export async function createCheckoutSession(request: Request) {
  const body = await request.json();

  // Check if user wants to use saved card
  if (body.useSavedCard && body.userId) {
    if (body.workshopId) {
      return quickCheckoutWorkshop(
        body.userId,
        body.workshopId,
        body.occurrenceId,
        body.connectId
      );
    }
  }

  // Membership Payment Branch
  if (body.membershipPlanId) {
    const {
      membershipPlanId,
      price,
      userId,
      compensationPrice,
      oldMembershipNextPaymentDate,
      userEmail,
    } = body; // <--- Note we read compensationPrice here
    if (!membershipPlanId || !price || !userId) {
      throw new Error("Missing required membership payment data");
    }
    const membershipPlan = await getMembershipPlanById(
      Number(membershipPlanId)
    );
    if (!membershipPlan) {
      throw new Error("Membership Plan not found");
    }

    let finalDescription = membershipPlan.description || "";
    if (compensationPrice && compensationPrice > 0) {
      finalDescription += `\nPay now: $${compensationPrice.toFixed(
        2
      )}. $${membershipPlan.price.toFixed(2)} starting ${
        oldMembershipNextPaymentDate
          ? new Date(oldMembershipNextPaymentDate).toLocaleDateString()
          : "N/A"
      }.`;
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
        compensationPrice: compensationPrice
          ? compensationPrice.toString()
          : "0",
        originalPrice: membershipPlan.price.toString(),
        currentMembershipId: body.currentMembershipId
          ? body.currentMembershipId.toString()
          : null,
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
  else if (
    body.equipmentId &&
    body.slotCount &&
    body.price &&
    body.userId &&
    body.slotsDataKey
  ) {
    const {
      equipmentId,
      slotCount,
      price,
      userId,
      slots,
      userEmail,
      slotsDataKey,
    } = body;
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
