import { Stripe } from "stripe";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  registerForWorkshop,
  registerUserForAllOccurrences,
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
  const gstRate = 0.05;
  const amountWithGST = amount * (1 + gstRate);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountWithGST * 100), // Convert to cents with GST included
    currency: "cad", // Changed from "usd" to "cad"
    customer: savedPayment.stripeCustomerId,
    payment_method: savedPayment.stripePaymentMethodId,
    description: `${description} (Includes 5% GST)`,
    metadata: {
      ...metadata,
      original_amount: amount.toString(),
      gst_amount: (amountWithGST - amount).toString(),
      total_with_gst: amountWithGST.toString(),
    },
    confirm: true, // Automatically confirm the payment
    off_session: true, // Payment is being made without customer present
    payment_method_types: ["card"],
  });

  return paymentIntent;
}

export async function quickCheckout(
  userId: number,
  checkoutData: {
    type: "workshop" | "equipment" | "membership";
    workshopId?: number;
    occurrenceId?: number;
    connectId?: number;
    equipmentId?: number;
    slotCount?: number;
    slots?: string[];
    slotsDataKey?: string;
    membershipPlanId?: number;
    price?: number;
    currentMembershipId?: number;
    upgradeFee?: number;
  }
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) throw new Error("User not found");

  let description = "";
  let price = 0;
  let metadata: Record<string, string> = {
    userId: userId.toString(),
  };

  switch (checkoutData.type) {
    case "workshop":
      if (!checkoutData.workshopId) throw new Error("Workshop ID required");

      const workshop = await getWorkshopById(checkoutData.workshopId);
      if (!workshop) throw new Error("Workshop not found");

      description = workshop.name;
      price = workshop.price;
      metadata.workshopId = checkoutData.workshopId.toString();

      if (checkoutData.occurrenceId) {
        const occurrence = await getWorkshopOccurrence(
          checkoutData.workshopId,
          checkoutData.occurrenceId
        );
        if (!occurrence) throw new Error("Occurrence not found");
        description += ` - ${new Date(occurrence.startDate).toLocaleString()}`;
        metadata.occurrenceId = checkoutData.occurrenceId.toString();
      } else if (checkoutData.connectId) {
        const occurrences = await getWorkshopOccurrencesByConnectId(
          checkoutData.workshopId,
          checkoutData.connectId
        );
        if (!occurrences || occurrences.length === 0)
          throw new Error("Occurrences not found");
        description += ` - ${occurrences.length} sessions`;
        metadata.connectId = checkoutData.connectId.toString();
      }
      break;

    case "equipment":
      if (
        !checkoutData.equipmentId ||
        !checkoutData.slotCount ||
        !checkoutData.price ||
        !checkoutData.slotsDataKey
      ) {
        throw new Error(
          "Equipment ID, slot count, price, and slots data required"
        );
      }
      description = `Equipment Booking (ID: ${checkoutData.equipmentId}) - ${checkoutData.slotCount} slots`;
      price = checkoutData.price;
      metadata.equipmentId = checkoutData.equipmentId.toString();
      metadata.slotCount = checkoutData.slotCount.toString();
      metadata.isEquipmentBooking = "true";
      metadata.slotsDataKey = checkoutData.slotsDataKey;
      break;

    case "membership":
      if (!checkoutData.membershipPlanId)
        throw new Error("Membership plan ID required");

      const membershipPlan = await getMembershipPlanById(
        checkoutData.membershipPlanId
      );
      if (!membershipPlan) throw new Error("Membership plan not found");

      description = membershipPlan.title;
      price = checkoutData.price || membershipPlan.price;
      metadata.membershipPlanId = checkoutData.membershipPlanId.toString();

      // Include additional metadata for membership upgrades
      if (checkoutData.currentMembershipId) {
        metadata.currentMembershipId =
          checkoutData.currentMembershipId.toString();
      }
      if (checkoutData.upgradeFee !== undefined) {
        metadata.upgradeFee = checkoutData.upgradeFee.toString();
      }
      break;

    default:
      throw new Error("Invalid checkout type");
  }

  try {
    const paymentIntent = await createPaymentIntentWithSavedCard(
      userId,
      price,
      description,
      metadata
    );

    // If payment is successful and it's a workshop, register the user
    if (paymentIntent.status === "succeeded") {
      try {
        if (checkoutData.type === "workshop") {
          if (checkoutData.connectId) {
            // Multi-day workshop registration
            await registerUserForAllOccurrences(
              checkoutData.workshopId!,
              checkoutData.connectId,
              userId
            );
          } else if (checkoutData.occurrenceId) {
            // Single occurrence registration
            await registerForWorkshop(
              checkoutData.workshopId!,
              checkoutData.occurrenceId,
              userId
            );
          }
        } else if (checkoutData.type === "membership") {
          // Handle membership subscription
          const { registerMembershipSubscription } = await import(
            "./membership.server"
          );

          const currentMembershipId = checkoutData.currentMembershipId || null;
          await registerMembershipSubscription(
            userId,
            checkoutData.membershipPlanId!,
            currentMembershipId
          );
        } else if (checkoutData.type === "equipment") {
          // Equipment booking will be handled by the frontend after success
          // Just mark it as successful here - the actual booking happens in the frontend
          console.log(
            `Equipment payment successful for user ${userId}, equipment ${checkoutData.equipmentId}`
          );
        }
      } catch (registrationError) {
        console.error(
          "Auto-registration failed after payment:",
          registrationError
        );
        // Don't fail the payment, but log the error
        // The user can still be manually registered if needed
      }
    }

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      amount: price,
      type: checkoutData.type,
    };
  } catch (error: any) {
    // If payment requires authentication, return the client secret
    if (error.raw?.payment_intent) {
      return {
        success: false,
        requiresAction: true,
        clientSecret: error.raw.payment_intent.client_secret,
        paymentIntentId: error.raw.payment_intent.id,
        type: checkoutData.type,
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
    // Determine checkout type and prepare data
    let checkoutData: any = { userId: body.userId };

    if (body.workshopId) {
      checkoutData = {
        type: "workshop",
        workshopId: body.workshopId,
        occurrenceId: body.occurrenceId,
        connectId: body.connectId,
      };
    } else if (body.equipmentId) {
      checkoutData = {
        type: "equipment",
        equipmentId: body.equipmentId,
        slotCount: body.slotCount,
        price: body.price,
        slots: body.slots,
        slotsDataKey: body.slotsDataKey,
      };
    } else if (body.membershipPlanId) {
      checkoutData = {
        type: "membership",
        membershipPlanId: body.membershipPlanId,
        price: body.price,
        currentMembershipId: body.currentMembershipId,
        upgradeFee: body.upgradeFee,
      };
    }

    if (checkoutData.type) {
      return quickCheckout(body.userId, checkoutData);
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

    // Calculate GST (5% for Canada)
    const gstRate = 0.05;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      line_items: [
        {
          price_data: {
            currency: "cad", // Changed from "usd" to "cad"
            product_data: {
              name: membershipPlan.title,
              description: `${finalDescription} (Includes 5% GST)`,
            },
            unit_amount: Math.round(priceWithGST * 100), // Price with GST included
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

    // Calculate GST (5% for Canada)
    const gstRate = 0.05;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad", // Changed from "usd" to "cad"
            product_data: {
              name: workshop.name,
              description: `${`Occurrence on ${new Date(
                occurrence.startDate
              ).toLocaleString()}`} (Includes 5% GST)`,
            },
            unit_amount: Math.round(priceWithGST * 100), // Price with GST included
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

    const gstRate = 0.05;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad", // Changed from "usd" to "cad"
            product_data: {
              name: workshop.name,
              description: `${description} (Includes 5% GST)`,
            },
            unit_amount: Math.round(priceWithGST * 100), // Price with GST included
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

    // Calculate GST (5% for Canada)
    const gstRate = 0.05;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad", // Changed from "usd" to "cad"
            product_data: {
              name: `Equipment Booking (ID: ${equipmentId})`,
              description: `Booking for ${slotCount} slots (Includes 5% GST)`,
            },
            unit_amount: Math.round(priceWithGST * 100), // Price with GST included
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
