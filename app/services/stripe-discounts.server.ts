import Stripe from "stripe";
import { db } from "~/utils/db.server";
import { getAdminSetting, updateAdminSetting } from "~/models/admin.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

/** AdminSettings key holding the Stripe Tax Rate id that matches `gst_percentage`. */
export const GST_TAX_RATE_SETTING_KEY = "stripe_gst_tax_rate_id";

const TAX_RATE_METADATA = { portal: "msyk", kind: "gst" } as const;

/**
 * Stripe Tax Rates are immutable — a GST change means a new rate, not an edit.
 * Resolve in order: the id we stored, then any rate we previously tagged, then create one.
 */
export async function getOrCreateGstTaxRate(
  percentage: number,
): Promise<string | null> {
  try {
    const storedId = await getAdminSetting(GST_TAX_RATE_SETTING_KEY, "");
    if (storedId) {
      try {
        const existing = await stripe.taxRates.retrieve(storedId);
        if (existing.active && existing.percentage === percentage) {
          return existing.id;
        }
      } catch {
        // Stored id is stale (wrong Stripe environment, or deleted) — fall through.
      }
    }

    const listed = await stripe.taxRates.list({ active: true, limit: 100 });
    const tagged = listed.data.find(
      (rate) =>
        rate.metadata?.portal === TAX_RATE_METADATA.portal &&
        rate.metadata?.kind === TAX_RATE_METADATA.kind &&
        rate.percentage === percentage &&
        !rate.inclusive,
    );
    if (tagged) {
      await updateAdminSetting(GST_TAX_RATE_SETTING_KEY, tagged.id);
      return tagged.id;
    }

    const created = await stripe.taxRates.create({
      display_name: "GST",
      description: `GST ${percentage}%`,
      percentage,
      inclusive: false,
      country: "CA",
      jurisdiction: "CA",
      metadata: { ...TAX_RATE_METADATA },
    });
    await updateAdminSetting(GST_TAX_RATE_SETTING_KEY, created.id);
    return created.id;
  } catch (error) {
    console.error("[stripe-discounts] Failed to resolve GST tax rate:", error);
    return null;
  }
}

/**
 * Read the coupon a member entered at Stripe Checkout.
 * Checkout reports it in two places depending on how it was applied, so check both.
 */
export async function getCheckoutSessionCouponId(
  sessionId: string,
): Promise<string | null> {
  try {
    // Stripe expands at most 4 levels, so stop at `.discount` — a Discount already
    // carries its coupon inline. Asking for `.discount.coupon` is rejected outright.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["total_details.breakdown.discounts.discount"],
    });

    const breakdown = session.total_details?.breakdown?.discounts ?? [];
    for (const entry of breakdown) {
      const coupon = entry.discount?.coupon;
      if (typeof coupon === "string") return coupon;
      if (coupon?.id) return coupon.id;
    }

    // A code typed at checkout is recorded as a promotion_code with coupon left null,
    // so resolve the promotion code to the coupon behind it.
    for (const entry of session.discounts ?? []) {
      const coupon = entry.coupon;
      if (typeof coupon === "string") return coupon;
      if (coupon?.id) return coupon.id;

      const promotionCode = entry.promotion_code;
      if (promotionCode) {
        const promo = await stripe.promotionCodes.retrieve(
          typeof promotionCode === "string" ? promotionCode : promotionCode.id,
        );
        return typeof promo.coupon === "string" ? promo.coupon : promo.coupon.id;
      }
    }

    return null;
  } catch (error) {
    console.error(
      `[stripe-discounts] Failed to read coupon from session ${sessionId}:`,
      error,
    );
    return null;
  }
}

/** A discount code an admin typed, resolved against Stripe. */
export interface ResolvedDiscountCode {
  couponId: string;
  /** Null when the admin typed a bare coupon id rather than a promotion code. */
  promotionCodeId: string | null;
  couponName: string | null;
  percentOff: number | null;
  /** Cents, as Stripe reports it. */
  amountOff: number | null;
  duration: string;
  durationInMonths: number | null;
  valid: boolean;
  /** Products the coupon is limited to; null means it applies to anything. */
  appliesToProducts: string[] | null;
  /** Promotion-code restrictions Stripe refuses to evaluate on a Customer. */
  blockingRestrictions: string[];
}

/**
 * Resolve what an admin typed — a promotion code like SUMMER50, or a raw coupon id —
 * into the coupon behind it.
 *
 * `applies_to` is the reason this always re-reads the coupon with an expand: a plain
 * retrieve omits the field entirely and a list returns it as null, so a product-scoped
 * coupon is indistinguishable from an unscoped one unless you ask for it explicitly.
 * Every caller that checks product scope depends on that expand being here.
 */
export async function resolveDiscountCode(
  code: string,
): Promise<ResolvedDiscountCode | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  try {
    const matches = await stripe.promotionCodes.list({
      code: trimmed,
      active: true,
      limit: 1,
    });
    const promotionCode = matches.data[0] ?? null;

    const couponId = promotionCode
      ? typeof promotionCode.coupon === "string"
        ? promotionCode.coupon
        : promotionCode.coupon.id
      : trimmed;

    const coupon = await stripe.coupons.retrieve(couponId, {
      expand: ["applies_to"],
    });

    const restrictions = promotionCode?.restrictions;
    const blockingRestrictions: string[] = [];
    if (restrictions?.minimum_amount != null) {
      blockingRestrictions.push("minimum_amount");
    }
    if (restrictions?.first_time_transaction) {
      blockingRestrictions.push("first_time_transaction");
    }

    return {
      couponId: coupon.id,
      promotionCodeId: promotionCode?.id ?? null,
      couponName: coupon.name ?? null,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months ?? null,
      valid: coupon.valid,
      appliesToProducts: coupon.applies_to?.products ?? null,
      blockingRestrictions,
    };
  } catch (error) {
    console.error(
      `[stripe-discounts] Could not resolve discount code "${trimmed}":`,
      error,
    );
    return null;
  }
}

export interface CouponDetail {
  couponId: string;
  /** Products the coupon is limited to; null means it applies to anything. */
  appliesToProducts: string[] | null;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  durationInMonths: number | null;
  /** The human-facing codes pointing at this coupon, for an admin to recognise it. */
  promotionCodes: string[];
}

/**
 * Look up several coupons at once, deduplicated.
 *
 * One Stripe round trip per distinct coupon, not per member: a handful of coupons
 * usually covers every discounted member. A coupon that cannot be read is omitted
 * rather than guessed at, so callers treat "missing" as unknown, never as unscoped.
 */
export async function getCouponDetails(
  couponIds: string[],
): Promise<Map<string, CouponDetail>> {
  const unique = Array.from(new Set(couponIds.filter(Boolean)));
  const found = new Map<string, CouponDetail>();

  await Promise.all(
    unique.map(async (couponId) => {
      try {
        const coupon = await stripe.coupons.retrieve(couponId, {
          expand: ["applies_to"],
        });
        let promotionCodes: string[] = [];
        try {
          const codes = await stripe.promotionCodes.list({
            coupon: couponId,
            limit: 10,
          });
          promotionCodes = codes.data.map((entry) => entry.code);
        } catch {
          // The code is a convenience for the admin, not load-bearing.
        }

        found.set(couponId, {
          couponId: coupon.id,
          appliesToProducts: coupon.applies_to?.products ?? null,
          percentOff: coupon.percent_off ?? null,
          amountOff: coupon.amount_off ?? null,
          duration: coupon.duration,
          durationInMonths: coupon.duration_in_months ?? null,
          promotionCodes,
        });
      } catch (error) {
        console.error(
          `[stripe-discounts] Could not read coupon ${couponId}:`,
          error,
        );
      }
    }),
  );

  return found;
}

/**
 * Pin a coupon to the Stripe Customer so every membership invoice we raise inherits it.
 *
 * Customer discounts are applied to Invoices only — payment-mode Checkout Sessions and
 * bare PaymentIntents ignore them, so this cannot leak into workshop or equipment sales.
 * A repeating coupon gets a wall-clock `end` from Stripe, which expires it without us
 * counting cycles.
 *
 * Pass `promotionCodeId` to redeem the promotion code rather than the bare coupon. That
 * is what makes Stripe enforce the limits set on the code: a max_redemptions cap is
 * ignored entirely when the same coupon is applied by id.
 */
export async function applyMembershipDiscount(
  customerId: string,
  couponId: string,
  userMembershipId?: number,
  promotionCodeId?: string | null,
): Promise<{ couponId: string; endsAt: Date | null } | null> {
  try {
    const customer = await stripe.customers.update(
      customerId,
      promotionCodeId
        ? { promotion_code: promotionCodeId }
        : { coupon: couponId },
    );
    const discount = customer.discount;
    const endsAt = discount?.end ? new Date(discount.end * 1000) : null;
    // Stripe is authoritative about which coupon actually landed, and the admin table
    // and End button key off that id.
    const appliedCouponId = discount?.coupon?.id ?? couponId;

    if (userMembershipId) {
      await db.userMembership.update({
        where: { id: userMembershipId },
        data: { stripeCouponId: appliedCouponId, discountEndsAt: endsAt },
      });
    }

    return { couponId: appliedCouponId, endsAt };
  } catch (error) {
    console.error(
      `[stripe-discounts] Failed to apply coupon ${couponId} to customer ${customerId}:`,
      error,
    );
    return null;
  }
}

/**
 * End a member's recurring discount. Called when they change plan — Stripe would
 * otherwise carry the discount onto the new plan.
 *
 * `deleteDiscount` throws when there is no active discount, so check first.
 */
export async function clearMembershipDiscount(
  customerId: string | null | undefined,
  userMembershipIds: number[] = [],
): Promise<boolean> {
  let cleared = false;
  try {
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.discount) {
        await stripe.customers.deleteDiscount(customerId);
        cleared = true;
      }
    }
  } catch (error) {
    console.error(
      `[stripe-discounts] Failed to clear discount for customer ${customerId}:`,
      error,
    );
  }

  if (userMembershipIds.length > 0) {
    try {
      await db.userMembership.updateMany({
        where: { id: { in: userMembershipIds } },
        data: { stripeCouponId: null, discountEndsAt: null },
      });
    } catch (error) {
      console.error(
        "[stripe-discounts] Failed to clear stored discount fields:",
        error,
      );
    }
  }

  return cleared;
}

/** The member's active recurring discount as Stripe currently sees it. */
export async function getCustomerDiscount(customerId: string): Promise<{
  couponId: string;
  percentOff: number | null;
  amountOff: number | null;
  endsAt: Date | null;
} | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || !customer.discount) return null;
    const { coupon, end } = customer.discount;
    return {
      couponId: coupon.id,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      endsAt: end ? new Date(end * 1000) : null,
    };
  } catch (error) {
    console.error(
      `[stripe-discounts] Failed to read discount for customer ${customerId}:`,
      error,
    );
    return null;
  }
}

/**
 * What Stripe will charge at the next renewal, for reminder emails and UI.
 *
 * Best effort — the authoritative numbers come back from the invoice. A discount that
 * expires before `chargeOn` is deliberately ignored so the reminder is not optimistic.
 */
export async function previewMembershipCharge(params: {
  customerId: string | null | undefined;
  baseAmount: number;
  gstPercentage: number;
  chargeOn?: Date;
}): Promise<{
  baseAmount: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}> {
  const { customerId, baseAmount, gstPercentage, chargeOn } = params;
  const round = (value: number) => Math.round(value * 100) / 100;

  let discountAmount = 0;
  if (customerId) {
    const discount = await getCustomerDiscount(customerId);
    const stillActive =
      discount && (!discount.endsAt || !chargeOn || discount.endsAt > chargeOn);

    if (discount && stillActive) {
      if (discount.percentOff != null) {
        discountAmount = round(baseAmount * (discount.percentOff / 100));
      } else if (discount.amountOff != null) {
        discountAmount = Math.min(round(discount.amountOff / 100), baseAmount);
      }
    }
  }

  const discountedBase = round(baseAmount - discountAmount);
  const taxAmount = round(discountedBase * (gstPercentage / 100));

  return {
    baseAmount: round(baseAmount),
    discountAmount,
    taxAmount,
    total: round(discountedBase + taxAmount),
  };
}

export interface MembershipInvoiceResult {
  invoiceId: string;
  paymentIntentId: string | null;
  status: string;
  /** Dollars, pre-discount and pre-GST. */
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * Charge a membership renewal as a Stripe Invoice rather than a bare PaymentIntent.
 *
 * The invoice is what makes recurring discounts possible: a PaymentIntent has no
 * discount object, which is why coupons only ever applied to the first payment.
 * GST rides as a Stripe Tax Rate so it is levied on the post-discount base.
 */
export async function chargeMembershipViaInvoice(params: {
  customerId: string;
  paymentMethodId: string;
  baseAmount: number;
  description: string;
  gstPercentage: number;
  metadata: Record<string, string>;
  /** The plan's Stripe Product. Required for coupons restricted to specific products. */
  stripeProductId?: string | null;
}): Promise<MembershipInvoiceResult> {
  const {
    customerId,
    paymentMethodId,
    baseAmount,
    description,
    gstPercentage,
    metadata,
    stripeProductId,
  } = params;

  const taxRateId = await getOrCreateGstTaxRate(gstPercentage);

  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "charge_automatically",
    default_payment_method: paymentMethodId,
    auto_advance: false,
    description,
    metadata,
  });

  if (!draft.id) throw new Error("Stripe did not return an invoice id");

  // Bind the line to this invoice explicitly. Pending invoice items are not swept in
  // automatically on this API version, and binding avoids picking up a stray item.
  //
  // Carry the plan's Product on the line whenever we have one: a coupon restricted with
  // "Apply to specific products" is ignored on a line with no product, which would leave
  // exactly those coupons discounting the first payment and nothing after it.
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draft.id,
    ...(stripeProductId
      ? {
          price_data: {
            currency: "cad",
            product: stripeProductId,
            unit_amount: Math.round(baseAmount * 100),
          },
        }
      : { amount: Math.round(baseAmount * 100), currency: "cad" }),
    description,
    ...(taxRateId ? { tax_rates: [taxRateId] } : {}),
  });

  let invoice = await stripe.invoices.finalizeInvoice(draft.id);

  // A fully discounted invoice settles itself; paying it again throws.
  if (invoice.status !== "paid") {
    invoice = await stripe.invoices.pay(invoice.id!, {
      payment_method: paymentMethodId,
    });
  }

  const discountAmount = (invoice.total_discount_amounts ?? []).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const taxAmount = (invoice.total_tax_amounts ?? []).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );

  // Kept as paymentIntentId on UserMembership so refundMembershipSubscription still works.
  const paymentIntent = invoice.payment_intent;

  return {
    invoiceId: invoice.id!,
    paymentIntentId:
      typeof paymentIntent === "string"
        ? paymentIntent
        : (paymentIntent?.id ?? null),
    status: invoice.status ?? "unknown",
    subtotal: (invoice.subtotal ?? 0) / 100,
    discountAmount: discountAmount / 100,
    taxAmount: taxAmount / 100,
    total: (invoice.total ?? 0) / 100,
  };
}
