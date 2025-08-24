import { Stripe } from "stripe";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  registerForWorkshop,
  registerUserForAllOccurrences,
  getWorkshopPriceVariation,
} from "./workshop.server";
import { getMembershipPlanById } from "./membership.server";
import { getSavedPaymentMethod } from "./user.server";
import { db } from "../utils/db.server";
import { getAdminSetting } from "./admin.server";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

/**
 * Creates a payment intent using a user's saved card with automatic GST calculation
 * @param userId - The ID of the user making the payment
 * @param amount - The base amount to charge (before GST)
 * @param description - Description for the payment intent
 * @param metadata - Additional metadata to attach to the payment
 * @returns Promise<Stripe.PaymentIntent> - The created and confirmed payment intent
 * @throws Error if no saved payment method is found
 */
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

  // Get dynamic GST rate from admin settings
  const { getAdminSetting } = await import("./admin.server");
  const gstPercentage = await getAdminSetting("gst_percentage", "5");
  const gstRate = parseFloat(gstPercentage) / 100;
  const amountWithGST = amount * (1 + gstRate);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountWithGST * 100), // Convert to cents with GST included
    currency: "cad",
    customer: savedPayment.stripeCustomerId,
    payment_method: savedPayment.stripePaymentMethodId,
    description: `${description} (Includes ${gstPercentage}% GST)`,
    metadata: {
      ...metadata,
      original_amount: amount.toString(),
      gst_amount: (amountWithGST - amount).toString(),
      total_with_gst: amountWithGST.toString(),
      gst_percentage: gstPercentage,
    },
    confirm: true, // Automatically confirm the payment
    off_session: true, // Payment is being made without customer present
    payment_method_types: ["card"],
  });

  return paymentIntent;
}

/**
 * Processes a quick checkout for various service types using saved payment methods
 * @param userId - The ID of the user making the purchase
 * @param checkoutData - Object containing checkout details including type, IDs, and pricing
 * @returns Promise<Object> - Payment result with success status and details
 * @throws Error if payment processing fails
 */
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
    variationId?: number;
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

      // Handle price variation
      if (checkoutData.variationId) {
        const variation = await getWorkshopPriceVariation(
          checkoutData.variationId
        );
        if (variation) {
          description += ` - ${variation.name}`;
          price = variation.price;
          metadata.variationId = checkoutData.variationId.toString();
        }
      }

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
              userId,
              checkoutData.variationId || null,
              paymentIntent.id
            );
          } else if (checkoutData.occurrenceId) {
            // Single occurrence registration
            await registerForWorkshop(
              checkoutData.workshopId!,
              checkoutData.occurrenceId,
              userId,
              checkoutData.variationId || null,
              paymentIntent.id
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
          // We store the payment intent ID in the frontend handling
          // The actual booking with payment intent ID happens in paymentsuccess.tsx
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

/**
 * Deletes a user's saved payment method from both Stripe and the database
 * @param userId - The ID of the user whose payment method should be deleted
 * @returns Promise<Object> - Success object with deletion confirmation
 * @throws Error if payment method deletion fails
 */
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

/**
 * Creates or updates a payment method for a user in Stripe and stores it in the database
 * @param userId - The ID of the user
 * @param data - Payment method data including card details and billing information
 * @returns Promise<Object> - Success object with payment method details
 * @throws Error if payment method creation/update fails
 */
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

/**
 * Creates a Stripe checkout session for different payment scenarios (workshops, memberships, equipment)
 * @param request - The HTTP request containing payment data in JSON format
 * @returns Promise<Response> - JSON response with checkout session URL or error
 * @throws Error if required payment data is missing or Stripe session creation fails
 */
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
        variationId: body.variationId,
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

    // Calculate GST
    const gstPercentage = await getAdminSetting("gst_percentage", "5");
    const gstRate = parseFloat(gstPercentage) / 100;
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
            currency: "cad",
            product_data: {
              name: membershipPlan.title,
              description: `${finalDescription} (Includes ${gstPercentage}% GST)`,
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
    const { workshopId, occurrenceId, price, userId, userEmail, variationId } =
      body;
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

    let workshopDisplayName = workshop.name;
    if (variationId) {
      const variation = await getWorkshopPriceVariation(Number(variationId));
      if (variation) {
        workshopDisplayName = `${workshop.name} - ${variation.name}`;
      }
    }

    // Calculate GST
    const gstPercentage = await getAdminSetting("gst_percentage", "5");
    const gstRate = parseFloat(gstPercentage) / 100;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: workshopDisplayName,
              description: `${`Occurrence on ${new Date(
                occurrence.startDate
              ).toLocaleString()}`} (Includes ${gstPercentage}% GST)`,
            },
            unit_amount: Math.round(priceWithGST * 100),
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
        variationId: variationId ? variationId.toString() : "",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Multi-day Workshop Payment
  else if (body.workshopId && body.connectId) {
    const { workshopId, connectId, price, userId, userEmail, variationId } =
      body;
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

    let workshopDisplayName = workshop.name;
    if (variationId) {
      const variation = await getWorkshopPriceVariation(Number(variationId));
      if (variation) {
        workshopDisplayName = `${workshop.name} - ${variation.name}`;
      }
    }

    const occurrencesDescription = occurrences
      .map((occ) => {
        const startStr = new Date(occ.startDate).toLocaleString();
        const endStr = new Date(occ.endDate).toLocaleString();
        return `  ${startStr} - ${endStr}`;
      })
      .join("\n");

    const description = `Occurrences:\n${occurrencesDescription}`;

    const gstPercentage = await getAdminSetting("gst_percentage", "5");
    const gstRate = parseFloat(gstPercentage) / 100;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: workshopDisplayName,
              description: `${description} (Includes ${gstPercentage}% GST)`,
            },
            unit_amount: Math.round(priceWithGST * 100),
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
        variationId: variationId ? variationId.toString() : "",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Equipment Booking Payment
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

    // Calculate GST
    const gstPercentage = await getAdminSetting("gst_percentage", "5");
    const gstRate = parseFloat(gstPercentage) / 100;
    const priceWithGST = price * (1 + gstRate);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `Equipment Booking (ID: ${equipmentId})`,
              description: `Booking for ${slotCount} slots (Includes ${gstPercentage}% GST)`,
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

/**
 * Processes a refund for a workshop registration
 * @param userId - The ID of the user requesting the refund
 * @param workshopId - The ID of the workshop
 * @param occurrenceId - The ID of the specific occurrence (optional for multi-day workshops)
 * @returns Promise<Object> - Refund result with success status
 * @throws Error if refund processing fails
 */
export async function refundWorkshopRegistration(
  userId: number,
  workshopId: number,
  occurrenceId?: number
) {
  try {
    // Find the registration(s) with payment intent ID
    const registrations = await db.userWorkshop.findMany({
      where: {
        userId,
        workshopId,
        ...(occurrenceId ? { occurrenceId } : {}),
        paymentIntentId: { not: null },
      },
    });

    if (registrations.length === 0) {
      throw new Error("No paid registration found for refund");
    }

    // Get the payment intent ID (should be the same for all registrations of a multi-day workshop)
    const paymentIntentId = registrations[0].paymentIntentId;

    if (!paymentIntentId) {
      throw new Error("No payment intent ID found for this registration");
    }

    // Process the refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: {
        userId: userId.toString(),
        workshopId: workshopId.toString(),
        ...(occurrenceId ? { occurrenceId: occurrenceId.toString() } : {}),
      },
    });

    // If refund is successful, remove the registration(s)
    if (refund.status === "succeeded") {
      await db.userWorkshop.deleteMany({
        where: {
          userId,
          workshopId,
          ...(occurrenceId ? { occurrenceId } : {}),
          paymentIntentId,
        },
      });
    }

    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
      amount: refund.amount / 100, // Convert back from cents
      status: refund.status,
    };
  } catch (error: any) {
    console.error("Refund processing failed:", error);
    throw new Error(`Refund failed: ${error.message}`);
  }
}

/**
 * Processes a refund for equipment bookings
 * @param userId - The ID of the user requesting the refund
 * @param equipmentId - The ID of the equipment
 * @param slotIds - Optional array of specific slot IDs to refund (if not provided, refunds all user's bookings for this equipment)
 * @returns Promise<Object> - Refund result with success status
 * @throws Error if refund processing fails
 */
export async function refundEquipmentBooking(
  userId: number,
  equipmentId?: number,
  slotIds?: number[]
) {
  try {
    // Find the booking(s) with payment intent ID
    const whereClause: any = {
      userId,
      bookedFor: "user", // Only individual user bookings, not workshop bookings
      paymentIntentId: { not: null },
    };

    if (equipmentId) {
      whereClause.equipmentId = equipmentId;
    }

    if (slotIds && slotIds.length > 0) {
      whereClause.slotId = { in: slotIds };
    }

    const bookings = await db.equipmentBooking.findMany({
      where: whereClause,
      include: {
        slot: true,
        equipment: true,
      },
    });

    if (bookings.length === 0) {
      throw new Error("No paid equipment bookings found for refund");
    }

    // Get the payment intent ID (should be the same for all bookings made in the same payment)
    const paymentIntentId = bookings[0].paymentIntentId;

    if (!paymentIntentId) {
      throw new Error("No payment intent ID found for these bookings");
    }

    // Verify all bookings have the same payment intent ID
    const differentPaymentIntents = bookings.filter(
      (booking) => booking.paymentIntentId !== paymentIntentId
    );

    if (differentPaymentIntents.length > 0) {
      throw new Error(
        "Cannot refund bookings from different payments together"
      );
    }

    // Process the refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: {
        userId: userId.toString(),
        bookingIds: bookings.map((b) => b.id.toString()).join(","),
        ...(equipmentId ? { equipmentId: equipmentId.toString() } : {}),
      },
    });

    // If refund is successful, remove the bookings and free up the slots
    if (refund.status === "succeeded") {
      const bookingIds = bookings.map((booking) => booking.id);
      const slotIdsToFree = bookings.map((booking) => booking.slotId);

      // Free up the equipment slots
      await db.equipmentSlot.updateMany({
        where: { id: { in: slotIdsToFree } },
        data: { isBooked: false },
      });

      // Remove the booking records
      await db.equipmentBooking.deleteMany({
        where: { id: { in: bookingIds } },
      });
    }

    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
      amount: refund.amount / 100, // Convert back from cents
      status: refund.status,
      bookingsRefunded: bookings.length,
      slotsFreed: bookings.length,
    };
  } catch (error: any) {
    console.error("Equipment refund processing failed:", error);
    throw new Error(`Equipment refund failed: ${error.message}`);
  }
}
