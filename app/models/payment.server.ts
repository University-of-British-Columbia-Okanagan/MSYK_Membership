import { Stripe } from "stripe";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  registerForWorkshop,
  registerUserForAllOccurrences,
  getWorkshopPriceVariation,
  checkWorkshopCapacity,
  checkMultiDayWorkshopCapacity,
} from "./workshop.server";
import {
  getMembershipPlanById,
  calculateProratedUpgradeAmount,
  getOwnedMembership,
  registerMembershipSubscription,
  activateMembershipForm,
  MEMBERSHIP_REVOKED_ERROR,
} from "./membership.server";
import {
  prepareEquipmentBooking,
  createEquipmentCheckout,
  fulfilEquipmentCheckout,
  bookEquipmentBulkByTimes,
  EquipmentBookingError,
} from "./equipment.server";
import { getSavedPaymentMethod } from "./user.server";
import { db } from "../utils/db.server";
import { getAdminSetting } from "./admin.server";
import { syncUserDoorAccess } from "~/services/access-control-sync.server";
import { getOrCreateGstTaxRate } from "~/services/stripe-discounts.server";
import { addBusinessMonths, formatBusinessDateTime } from "~/utils/business-time";
import {
  BILLING_CYCLE_LABELS,
  MembershipChangeError,
  assertPlanPermission,
  getPlanPriceForCycle,
  isBillingCycle,
  type BillingCycle,
} from "~/utils/membership-rules";
import { isPastRegistrationCutoff } from "~/utils/registration-cutoff";
import {
  sendWorkshopConfirmationEmail,
  sendMembershipConfirmationEmail,
  checkPaymentMethodStatus,
} from "~/utils/email.server";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export type FulfillmentKind = "workshop" | "membership" | "equipment";

/**
 * Records that a Stripe payment (cs_... or pi_...) is being turned into a
 * registration, membership or booking. Returns false when it already was, so
 * a reloaded success page cannot fulfil the same payment twice.
 */
export async function claimPaymentFulfillment(
  stripeRef: string,
  userId: number,
  kind: FulfillmentKind
): Promise<boolean> {
  try {
    await db.paymentFulfillment.create({ data: { stripeRef, userId, kind } });
    return true;
  } catch (error: any) {
    if (error?.code === "P2002") return false;
    throw error;
  }
}

/** Drops a claim whose fulfilment failed, so the success page can retry it on reload. */
export async function releasePaymentFulfillment(stripeRef: string) {
  await db.paymentFulfillment.deleteMany({ where: { stripeRef } });
}

type WorkshopSelection = {
  workshopId: number;
  occurrenceId?: number | null;
  connectId?: number | null;
  variationId?: number | null;
};

const toId = (value: unknown): number | null => {
  const n = Number(value);
  return value != null && value !== "" && Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Loads a workshop purchase and prices it from the database. Refuses what the
 * payment page refuses (cancelled, ended, full, past the registration cutoff)
 * and a price variation that belongs to another workshop.
 */
export async function resolveWorkshopPurchase(selection: WorkshopSelection) {
  const fail = (error: string) => ({ ok: false as const, error });
  const { workshopId, occurrenceId, connectId, variationId } = selection;

  let workshop;
  let occurrences;
  try {
    workshop = await getWorkshopById(workshopId);
    if (occurrenceId) {
      occurrences = [await getWorkshopOccurrence(workshopId, occurrenceId)];
    } else if (connectId) {
      occurrences = await getWorkshopOccurrencesByConnectId(workshopId, connectId);
    }
  } catch {
    return fail("Workshop or session not found.");
  }
  if (!workshop || !occurrences || occurrences.length === 0) {
    return fail("Workshop or session not found.");
  }

  let variation = null;
  if (variationId) {
    variation = await getWorkshopPriceVariation(variationId);
    if (!variation || variation.workshopId !== workshopId) {
      return fail("That price option does not belong to this workshop.");
    }
  }

  const now = new Date();
  if (occurrences.some((o) => o.status === "cancelled")) {
    return fail("This workshop session has been cancelled.");
  }
  if (occurrences.some((o) => new Date(o.endDate) < now)) {
    return fail("This workshop session has already ended.");
  }
  if (isPastRegistrationCutoff(new Date(occurrences[0].startDate), workshop.registrationCutoff)) {
    return fail("Registration for this workshop has closed.");
  }

  const capacity = occurrenceId
    ? await checkWorkshopCapacity(workshopId, occurrenceId, variationId ?? null)
    : await checkMultiDayWorkshopCapacity(workshopId, connectId!, variationId ?? null);
  if (!capacity?.hasCapacity) return fail("This workshop is full.");

  return {
    ok: true as const,
    workshop,
    occurrences,
    variation,
    isMultiDay: !occurrenceId,
    price: variation ? variation.price : workshop.price,
    displayName: variation ? `${workshop.name} - ${variation.name}` : workshop.name,
  };
}

type ResolvedWorkshop = Extract<Awaited<ReturnType<typeof resolveWorkshopPurchase>>, { ok: true }>;

/** Registers the member for a resolved workshop purchase and sends the confirmation email. */
async function registerWorkshopPurchase(
  userId: number,
  userEmail: string | null | undefined,
  selection: WorkshopSelection,
  purchase: ResolvedWorkshop,
  paymentIntentId?: string
) {
  const variationId = purchase.variation?.id ?? null;
  if (purchase.isMultiDay) {
    await registerUserForAllOccurrences(
      selection.workshopId,
      selection.connectId!,
      userId,
      variationId,
      paymentIntentId
    );
  } else {
    await registerForWorkshop(
      selection.workshopId,
      selection.occurrenceId!,
      userId,
      variationId,
      paymentIntentId
    );
  }

  if (!userEmail) return;
  try {
    const { workshop, variation, occurrences } = purchase;
    await sendWorkshopConfirmationEmail({
      userEmail,
      workshopName: workshop.name,
      ...(purchase.isMultiDay
        ? { sessions: occurrences.map((o) => ({ startDate: o.startDate, endDate: o.endDate })) }
        : { startDate: occurrences[0].startDate, endDate: occurrences[0].endDate }),
      location: workshop.location,
      basePrice: workshop.price,
      priceVariation: variation
        ? { name: variation.name, description: variation.description, price: variation.price }
        : null,
    });
  } catch (emailError) {
    console.error("Failed to send workshop confirmation email:", emailError);
  }
}

/**
 * Prices a membership purchase from the plan and the chosen billing cycle, or
 * the server's proration for an upgrade from the member's own active monthly plan.
 */
export async function resolveMembershipPurchase(
  userId: number,
  input: { membershipPlanId: unknown; billingCycle?: unknown; currentMembershipId?: unknown }
) {
  const fail = (error: string, status = 400) => ({ ok: false as const, error, status });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, membershipStatus: true, roleLevel: true, allowLevel4: true },
  });
  if (!user) return fail("User not found.", 404);
  if (user.membershipStatus === "revoked") {
    return fail("Your membership access has been revoked.", 403);
  }

  const plan = await getMembershipPlanById(Number(input.membershipPlanId));
  if (!plan) return fail("Membership plan not found.", 404);

  const billingCycle = input.billingCycle ?? "monthly";
  const cyclePrice = isBillingCycle(billingCycle) ? getPlanPriceForCycle(plan, billingCycle) : null;
  if (!isBillingCycle(billingCycle) || cyclePrice == null) {
    const label = isBillingCycle(billingCycle) ? BILLING_CYCLE_LABELS[billingCycle] : "that";
    return fail(`This plan is not offered with ${label} billing. Please choose another billing cycle.`);
  }

  try {
    assertPlanPermission(user, plan);
  } catch (error) {
    return fail((error as Error).message, 403);
  }

  let price = cyclePrice;
  let currentMembershipId: number | null = null;
  if (input.currentMembershipId) {
    let current;
    try {
      current = await getOwnedMembership(userId, Number(input.currentMembershipId), "active");
    } catch (error) {
      if (error instanceof MembershipChangeError) return fail(error.message);
      throw error;
    }
    if (current.billingCycle !== "monthly" || billingCycle !== "monthly") {
      return fail(
        "Only monthly-to-monthly upgrades are supported. Please cancel your current term."
      );
    }
    const fee = calculateProratedUpgradeAmount(
      new Date(),
      new Date(current.nextPaymentDate),
      Number(current.membershipPlan.price),
      Number(plan.price)
    );
    if (fee <= 0) return fail("No payment required for this switch.", 200);
    price = fee;
    currentMembershipId = current.id;
  }

  return { ok: true as const, user, plan, billingCycle, price, currentMembershipId };
}

type ResolvedMembership = Extract<
  Awaited<ReturnType<typeof resolveMembershipPurchase>>,
  { ok: true }
>;

/** Creates the member's subscription for a resolved purchase, then the form and email. */
async function registerMembershipPurchase(
  userId: number,
  purchase: ResolvedMembership,
  autoRenew: boolean,
  paymentIntentId?: string
) {
  const { plan, billingCycle } = purchase;
  const subscription = await registerMembershipSubscription(
    userId,
    plan.id,
    purchase.currentMembershipId,
    false,
    false,
    paymentIntentId,
    billingCycle,
    autoRenew
  );

  // The membership exists from here on; nothing below may undo or repeat it.
  try {
    await activateMembershipForm(userId, plan.id, subscription.id);
  } catch (error) {
    console.error("Failed to activate membership form:", error);
  }

  try {
    const months =
      billingCycle === "semiannually" ? 6 : billingCycle === "quarterly" ? 3 : billingCycle === "yearly" ? 12 : 1;
    const gstSetting = await getAdminSetting("gst_percentage", "5");
    await sendMembershipConfirmationEmail({
      userEmail: purchase.user.email,
      planTitle: plan.title,
      planDescription: plan.description,
      monthlyPrice: plan.price,
      features: plan.feature as Record<string, string>,
      needAdminPermission: plan.needAdminPermission,
      billingCycle,
      planPrice: getPlanPriceForCycle(plan, billingCycle) ?? plan.price,
      nextBillingDate:
        billingCycle === "monthly" ? addBusinessMonths(new Date(), months) : undefined,
      needsPaymentMethod: await checkPaymentMethodStatus(userId),
      autoRenew,
      gstPercentage: parseFloat(gstSetting),
    });
  } catch (emailError) {
    console.error("Failed to send membership confirmation email:", emailError);
  }
  return subscription;
}

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

export type QuickCheckoutData = {
  type: "workshop" | "equipment" | "membership";
  workshopId?: number;
  occurrenceId?: number | null;
  connectId?: number | null;
  variationId?: number | null;
  equipmentId?: number;
  slots?: unknown;
  membershipPlanId?: number;
  currentMembershipId?: number | null;
  billingCycle?: BillingCycle;
  autoRenew?: boolean;
};

/**
 * Charges the member's saved card for a workshop, equipment booking or
 * membership, priced on the server, and fulfils it before reporting success.
 * @param userId - The signed-in member; never taken from the request body
 */
export async function quickCheckout(userId: number, checkoutData: QuickCheckoutData) {
  const type = checkoutData.type;
  const fail = (error: string) => ({ success: false as const, error, type });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, membershipStatus: true, roleLevel: true, allowLevel4: true },
  });
  if (!user) throw new Error("User not found");

  const metadata: Record<string, string> = { userId: userId.toString() };
  let description = "";
  let price = 0;
  // Turns the purchase into a registration, booking or membership.
  let fulfil: (paymentIntentId?: string) => Promise<unknown>;

  switch (type) {
    case "workshop": {
      const selection: WorkshopSelection = {
        workshopId: Number(checkoutData.workshopId),
        occurrenceId: toId(checkoutData.occurrenceId),
        connectId: toId(checkoutData.connectId),
        variationId: toId(checkoutData.variationId),
      };
      if (!selection.workshopId || (!selection.occurrenceId && !selection.connectId)) {
        return fail("Workshop details are missing.");
      }
      const purchase = await resolveWorkshopPurchase(selection);
      if (!purchase.ok) return fail(purchase.error);

      price = purchase.price;
      description = purchase.isMultiDay
        ? `${purchase.displayName} - ${purchase.occurrences.length} sessions`
        : `${purchase.displayName} - ${formatBusinessDateTime(purchase.occurrences[0].startDate)}`;
      metadata.workshopId = String(selection.workshopId);
      if (selection.occurrenceId) metadata.occurrenceId = String(selection.occurrenceId);
      if (selection.connectId) metadata.connectId = String(selection.connectId);
      if (purchase.variation) metadata.variationId = String(purchase.variation.id);
      fulfil = (pi) => registerWorkshopPurchase(userId, user.email, selection, purchase, pi);
      break;
    }

    case "equipment": {
      const equipmentId = Number(checkoutData.equipmentId);
      let prepared;
      try {
        prepared = await prepareEquipmentBooking(userId, equipmentId, checkoutData.slots);
      } catch (error) {
        if (error instanceof EquipmentBookingError) return fail(error.message);
        throw error;
      }
      price = prepared.amount;
      description = `${prepared.equipment.name} - ${prepared.slots.length} slots`;
      metadata.equipmentId = String(equipmentId);
      metadata.isEquipmentBooking = "true";

      if (price === 0) {
        fulfil = () => bookEquipmentBulkByTimes(userId, equipmentId, prepared.slots);
      } else {
        const checkout = await createEquipmentCheckout(userId, equipmentId, prepared.slots, price);
        metadata.equipmentCheckoutId = checkout.id;
        fulfil = (pi) => fulfilEquipmentCheckout(checkout.id, userId, pi ?? null);
      }
      break;
    }

    case "membership": {
      const autoRenew = checkoutData.autoRenew ?? true;
      const purchase = await resolveMembershipPurchase(userId, {
        membershipPlanId: checkoutData.membershipPlanId,
        billingCycle: checkoutData.billingCycle,
        currentMembershipId: checkoutData.currentMembershipId,
      });
      if (!purchase.ok) return fail(purchase.error);

      price = purchase.price;
      description = purchase.plan.title;
      metadata.membershipPlanId = String(purchase.plan.id);
      metadata.billingCycle = purchase.billingCycle;
      metadata.autoRenew = String(autoRenew);
      if (purchase.currentMembershipId) {
        metadata.currentMembershipId = String(purchase.currentMembershipId);
      }
      fulfil = (pi) => registerMembershipPurchase(userId, purchase, autoRenew, pi);
      break;
    }

    default:
      throw new Error("Invalid checkout type");
  }

  // Free only when the server's price is zero.
  if (price === 0) {
    try {
      await fulfil();
    } catch (error) {
      console.error(`Free ${type} quick checkout failed:`, error);
      return fail(userMessage(error, "We could not complete this. Please try again."));
    }
    return { success: true, paymentIntentId: null, amount: 0, type };
  }

  let paymentIntent;
  try {
    paymentIntent = await createPaymentIntentWithSavedCard(userId, price, description, metadata);
  } catch (error: any) {
    // If payment requires authentication, return the client secret
    if (error.raw?.payment_intent) {
      return {
        success: false,
        requiresAction: true,
        clientSecret: error.raw.payment_intent.client_secret,
        paymentIntentId: error.raw.payment_intent.id,
        type,
      };
    }
    if (error instanceof Error && error.message === "No saved payment method found") {
      return fail("You have no saved card. Please use the regular checkout below.");
    }
    throw error;
  }

  if (paymentIntent.status !== "succeeded") {
    return fail("The payment was not completed. Please use the regular checkout below.");
  }

  await claimPaymentFulfillment(paymentIntent.id, userId, type);
  try {
    await fulfil(paymentIntent.id);
  } catch (error) {
    // Released so the payment is not recorded as fulfilled when it was not.
    await releasePaymentFulfillment(paymentIntent.id).catch(() => {});
    console.error(`Fulfilment failed after quick checkout payment ${paymentIntent.id}:`, error);
    const reason =
      error instanceof Error && error.message === MEMBERSHIP_REVOKED_ERROR
        ? "Membership access revoked."
        : userMessage(error, "Something went wrong.");
    return {
      success: false,
      error: `Your card was charged but we could not complete your ${type === "equipment" ? "booking" : type === "membership" ? "membership" : "registration"}. ${reason} Please contact support.`,
      paymentIntentId: paymentIntent.id,
      type,
    };
  }

  return { success: true, paymentIntentId: paymentIntent.id, amount: price, type };
}

/** A thrown error's message when it is written for members, else `fallback`. */
function userMessage(error: unknown, fallback: string) {
  if (error instanceof EquipmentBookingError || error instanceof MembershipChangeError) {
    return error.message;
  }
  return fallback;
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

    // Disable auto-renew on any active membership since there's no payment method
    await db.userMembership.updateMany({
      where: { userId, status: { in: ["active", "ending", "cancelled"] } },
      data: { autoRenew: false },
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
    stripeToken: string;
    cardholderName: string;
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

    // Create a payment method using the token generated by Stripe.js on the client
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: data.stripeToken,
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

    const cardLast4 = paymentMethod.card?.last4 || "";
    const expMonth = paymentMethod.card?.exp_month || 0;
    const expYear = paymentMethod.card?.exp_year || 0;
    const cardExpiry = `${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`;

    // Save to database
    await db.userPaymentInformation.upsert({
      where: { userId },
      update: {
        stripeCustomerId,
        stripePaymentMethodId: paymentMethod.id,
        cardholderName: data.cardholderName,
        cardLast4,
        cardExpiry,
        expMonth,
        expYear,
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
        cardLast4,
        cardExpiry,
        expMonth,
        expYear,
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
 * Starts a Stripe Checkout Session (or a saved-card quick checkout) for a
 * workshop, membership or held equipment checkout. Everything is priced here;
 * any price or user id in the body is ignored.
 * @param request - The JSON request from the payment page or booking action
 * @param userId - The signed-in member, from the caller's session
 */
export async function createCheckoutSession(request: Request, userId: number) {
  const body = await request.json();
  const autoRenew =
    typeof body.autoRenew === "boolean"
      ? body.autoRenew
      : body.autoRenew === "false" || body.autoRenew === "0"
        ? false
        : true;

  if (body.useSavedCard) {
    let checkoutData: QuickCheckoutData | null = null;
    if (body.workshopId) {
      checkoutData = {
        type: "workshop",
        workshopId: body.workshopId,
        occurrenceId: body.occurrenceId,
        connectId: body.connectId,
        variationId: body.variationId,
      };
    } else if (body.equipmentId) {
      checkoutData = { type: "equipment", equipmentId: body.equipmentId, slots: body.slots };
    } else if (body.membershipPlanId) {
      checkoutData = {
        type: "membership",
        membershipPlanId: body.membershipPlanId,
        currentMembershipId: body.currentMembershipId,
        billingCycle: body.billingCycle || "monthly",
        autoRenew,
      };
    }
    if (checkoutData) return quickCheckout(userId, checkoutData);
  }

  if (body.membershipPlanId) {
    const purchase = await resolveMembershipPurchase(userId, body);
    if (!purchase.ok) {
      return jsonResponse({ success: false, error: purchase.error }, purchase.status);
    }
    const { plan, billingCycle, price } = purchase;
    const gstPercentage = await getAdminSetting("gst_percentage", "5");

    // GST rides as a tax rate rather than being folded into unit_amount, so a promotion
    // code discounts the base and GST is charged on the discounted amount, matching how
    // renewals are invoiced. Folding it in would tax the full price at signup only.
    const gstTaxRateId = await getOrCreateGstTaxRate(parseFloat(gstPercentage));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      allow_promotion_codes: true,
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      line_items: [
        {
          price_data: {
            currency: "cad",
            ...(plan.stripeProductId
              ? { product: plan.stripeProductId }
              : {
                  product_data: {
                    name: plan.title,
                    description: `${plan.description || "Membership"} (plus ${gstPercentage}% GST)`,
                  },
                }),
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
          ...(gstTaxRateId ? { tax_rates: [gstTaxRateId] } : {}),
        },
      ],
      success_url: `${process.env.BASE_URL}dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}dashboard/memberships`,
      metadata: {
        membershipPlanId: plan.id.toString(),
        userId: userId.toString(),
        originalPrice: plan.price.toString(),
        currentMembershipId: purchase.currentMembershipId
          ? String(purchase.currentMembershipId)
          : null,
        billingCycle,
        autoRenew: String(autoRenew),
      },
    });
    return jsonResponse({ url: session.url });
  }

  if (body.workshopId && (body.occurrenceId || body.connectId)) {
    const selection: WorkshopSelection = {
      workshopId: Number(body.workshopId),
      occurrenceId: toId(body.occurrenceId),
      connectId: body.occurrenceId ? null : toId(body.connectId),
      variationId: toId(body.variationId),
    };
    const purchase = await resolveWorkshopPurchase(selection);
    if (!purchase.ok) return jsonResponse({ error: purchase.error }, 400);

    if (purchase.price === 0) {
      try {
        const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
        await registerWorkshopPurchase(userId, user?.email, selection, purchase);
      } catch (error: any) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({
        url: `/dashboard/payment/success?quick_checkout=true&type=workshop&free=1`,
      });
    }

    const gstPercentage = await getAdminSetting("gst_percentage", "5");
    const gstRate = parseFloat(gstPercentage) / 100;
    const priceWithGST = purchase.price * (1 + gstRate);
    const { workshop, occurrences } = purchase;
    const description = purchase.isMultiDay
      ? `Occurrences:\n${occurrences
          .map((o) => `  ${formatBusinessDateTime(o.startDate)} - ${formatBusinessDateTime(o.endDate)}`)
          .join("\n")}`
      : `Occurrence on ${formatBusinessDateTime(occurrences[0].startDate)}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "cad",
            ...(workshop.stripeProductId
              ? { product: workshop.stripeProductId }
              : {
                  product_data: {
                    name: purchase.displayName,
                    description: `${description} (Includes ${gstPercentage}% GST)`,
                  },
                }),
            unit_amount: Math.round(priceWithGST * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL}dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}dashboard/workshops`,
      metadata: {
        workshopId: selection.workshopId.toString(),
        ...(selection.occurrenceId
          ? { occurrenceId: selection.occurrenceId.toString() }
          : { connectId: String(selection.connectId) }),
        userId: userId.toString(),
        variationId: purchase.variation ? purchase.variation.id.toString() : "",
      },
    });
    return jsonResponse({ url: session.url });
  }

  if (body.equipmentCheckoutId) {
    const checkout = await db.equipmentCheckout.findUnique({
      where: { id: String(body.equipmentCheckoutId) },
    });
    if (!checkout || checkout.userId !== userId || checkout.fulfilledAt || checkout.amount <= 0) {
      return jsonResponse({ error: "Booking details not found." }, 404);
    }
    const slotCount = Array.isArray(checkout.slots) ? checkout.slots.length : 0;

    const gstPercentage = await getAdminSetting("gst_percentage", "5");
    const gstRate = parseFloat(gstPercentage) / 100;
    const priceWithGST = checkout.amount * (1 + gstRate);

    const equipment = await db.equipment.findUnique({
      where: { id: checkout.equipmentId },
      select: { name: true, stripeProductId: true },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "cad",
            ...(equipment?.stripeProductId
              ? { product: equipment.stripeProductId }
              : {
                  product_data: {
                    name: equipment?.name ?? `Equipment Booking (ID: ${checkout.equipmentId})`,
                    description: `Booking for ${slotCount} slots (Includes ${gstPercentage}% GST)`,
                  },
                }),
            unit_amount: Math.round(priceWithGST * 100), // Price with GST included
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL}dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}dashboard/equipments`,
      metadata: {
        equipmentId: checkout.equipmentId.toString(),
        equipmentCheckoutId: checkout.id,
        userId: userId.toString(),
        slotCount: slotCount.toString(),
        isEquipmentBooking: "true",
      },
    });
    return jsonResponse({ url: session.url });
  }

  return jsonResponse({ error: "Missing required payment parameters" }, 400);
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

/**
 * Processes a refund for a membership subscription
 * @param userId - The ID of the user requesting the refund
 * @param membershipId - The ID of the specific membership to refund (optional)
 * @returns Promise<Object> - Refund result with success status
 * @throws Error if refund processing fails
 */
export async function refundMembershipSubscription(
  userId: number,
  membershipId?: number
) {
  try {
    // Find the membership(s) with payment intent ID
    const whereClause: any = {
      userId,
      paymentIntentId: { not: null },
      status: { in: ["active", "ending"] }, // Only refund active or ending memberships
    };

    if (membershipId) {
      whereClause.id = membershipId;
    }

    const memberships = await db.userMembership.findMany({
      where: whereClause,
      include: {
        membershipPlan: true,
      },
      orderBy: {
        date: "desc", // Most recent first
      },
    });

    if (memberships.length === 0) {
      throw new Error("No paid membership found for refund");
    }

    // For membership refunds, we typically want to refund the most recent payment
    const membershipToRefund = memberships[0];
    const paymentIntentId = membershipToRefund.paymentIntentId;

    if (!paymentIntentId) {
      throw new Error("No payment intent ID found for this membership");
    }

    // Process the refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: {
        userId: userId.toString(),
        membershipId: membershipToRefund.id.toString(),
        membershipPlanId: membershipToRefund.membershipPlanId.toString(),
        refundType: "membership_cancellation",
      },
    });

    // If refund is successful, cancel the membership
    if (refund.status === "succeeded") {
      await db.userMembership.update({
        where: { id: membershipToRefund.id },
        data: {
          status: "cancelled",
          // Keep the paymentIntentId for record keeping, but it's now refunded
        },
      });

      // Update user's role level since membership is cancelled
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { roleLevel: true },
      });

      if (user && user.roleLevel >= 3) {
        // Check if user has passed orientations to determine new role level
        const passedOrientationsCount = await db.userWorkshop.count({
          where: {
            userId,
            result: { equals: "passed", mode: "insensitive" },
            workshop: {
              type: { equals: "orientation", mode: "insensitive" },
            },
          },
        });

        // Set role level based on orientation status (3 with membership, 2 without)
        const newRoleLevel = passedOrientationsCount > 0 ? 2 : 1;

        await db.user.update({
          where: { id: userId },
          data: { roleLevel: newRoleLevel },
        });
        try {
          await syncUserDoorAccess(userId);
        } catch (syncError) {
          console.error(
            "Failed to sync door access after membership cancellation:",
            syncError
          );
          // TODO: Add alerting/monitoring here for critical security events
        }      }
    }

    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
      amount: refund.amount / 100, // Convert back from cents
      status: refund.status,
      membershipPlan: membershipToRefund.membershipPlan.title,
      membershipCancelled: refund.status === "succeeded",
    };
  } catch (error: any) {
    console.error("Membership refund processing failed:", error);
    throw new Error(`Membership refund failed: ${error.message}`);
  }
}
