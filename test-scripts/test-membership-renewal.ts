import { PrismaClient } from "@prisma/client";
import {
  chargeMembershipViaInvoice,
  getCustomerDiscount,
} from "../app/services/stripe-discounts.server";

/**
 * Drive a membership renewal on demand, so recurring discounts can be checked without
 * waiting for the midnight billing cron.
 *
 * This runs the same charge the cron runs — an invoice, with the plan's Stripe Product on
 * the line and GST as a tax rate — but does not advance nextPaymentDate, so it is safe to
 * run repeatedly against the same member.
 *
 *   npx tsx test-scripts/test-membership-renewal.ts testuser4@gmail.com
 */

const db = new PrismaClient();

const money = (n: number) => `$${n.toFixed(2)}`;

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx test-scripts/test-membership-renewal.ts <email>");
    process.exit(1);
  }

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!user) throw new Error(`No user found for ${email}`);

  const membership = await db.userMembership.findFirst({
    where: { userId: user.id, status: { in: ["active", "ending"] } },
    orderBy: { id: "desc" },
    include: { membershipPlan: true },
  });
  if (!membership) throw new Error(`${email} has no active membership`);

  const payment = await db.userPaymentInformation.findUnique({
    where: { userId: user.id },
  });
  if (!payment?.stripeCustomerId || !payment?.stripePaymentMethodId) {
    throw new Error(
      `${email} has no saved card. The real cron would mark this membership inactive ` +
        `instead of charging. Add one at /user/profile/paymentinformation first.`,
    );
  }

  const plan = membership.membershipPlan;
  const baseAmount =
    membership.billingCycle === "quarterly" && plan.price3Months
      ? Number(plan.price3Months)
      : membership.billingCycle === "semiannually" && plan.price6Months
        ? Number(plan.price6Months)
        : membership.billingCycle === "yearly" && plan.priceYearly
          ? Number(plan.priceYearly)
          : Number(plan.price);

  const gstSetting = await db.adminSettings.findUnique({
    where: { key: "gst_percentage" },
  });
  const gstPercentage = parseFloat(gstSetting?.value ?? "5");

  console.log(`Member:        ${user.firstName} ${user.lastName} <${user.email}>`);
  console.log(`Plan:          ${plan.title} (${membership.billingCycle}) — list ${money(baseAmount)}`);
  console.log(`Saved card:    •••• ${payment.cardLast4 ?? "????"}`);
  console.log(`Plan synced:   ${plan.stripeProductId ?? "NO — restricted coupons cannot apply"}`);

  const discount = await getCustomerDiscount(payment.stripeCustomerId);
  console.log(
    `Discount:      ${
      discount
        ? `${discount.percentOff ?? `${money((discount.amountOff ?? 0) / 100)} off`}${
            discount.percentOff ? "%" : ""
          } until ${discount.endsAt?.toISOString().slice(0, 10) ?? "never"}`
        : "none"
    }`,
  );

  console.log("\nCharging a renewal invoice…\n");

  const charge = await chargeMembershipViaInvoice({
    customerId: payment.stripeCustomerId,
    paymentMethodId: payment.stripePaymentMethodId,
    baseAmount,
    description: `${plan.title} - ${membership.billingCycle} membership`,
    gstPercentage,
    metadata: {
      userId: String(user.id),
      membershipId: String(membership.id),
      planId: String(membership.membershipPlanId),
      payment_type: "manual_renewal_test",
    },
    stripeProductId: plan.stripeProductId,
  });

  console.log(`  Invoice     ${charge.invoiceId}  (${charge.status})`);
  console.log(`  Base        ${money(charge.subtotal)}`);
  console.log(`  Discount   -${money(charge.discountAmount)}`);
  console.log(`  GST (${gstPercentage}%)   ${money(charge.taxAmount)}`);
  console.log(`  TOTAL       ${money(charge.total)}`);
  console.log(`  PaymentIntent ${charge.paymentIntentId ?? "none"}`);

  if (charge.discountAmount > 0) {
    console.log(`\n✅ The discount applied to this renewal.`);
  } else {
    console.log(
      `\n⚠️  No discount on this renewal. Expected if the member has none, or if the ` +
        `coupon is product-restricted and this plan is not synced to Stripe.`,
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(`FAILED: ${error.message}`);
  await db.$disconnect();
  process.exit(1);
});
