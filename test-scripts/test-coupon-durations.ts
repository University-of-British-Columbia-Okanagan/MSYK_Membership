// Loaded explicitly: the sibling scripts only get .env as a side effect of importing
// PrismaClient, and this one has no database access.
import "dotenv/config";
import { Stripe } from "stripe";

/**
 * Show how a coupon duration behaves against a given billing cycle, using Stripe test
 * clocks to fast-forward through real renewals.
 *
 * This lives here rather than in the Jest suite on purpose: coupon duration is Stripe's
 * behaviour, not ours. Asserting it against a mocked Stripe would only test the mock.
 * The Jest suite covers our half — which price each cycle reads, how far nextPaymentDate
 * moves, and that the plan's Product rides on the invoice line.
 *
 * The headline: "multiple months" counts CALENDAR months, not billing periods. On a
 * monthly plan a 6-month coupon discounts ~6 payments; on a six-month plan it discounts
 * one.
 *
 *   npx tsx test-scripts/test-coupon-durations.ts                        # monthly, 6 months
 *   npx tsx test-scripts/test-coupon-durations.ts semiannually 6
 *   npx tsx test-scripts/test-coupon-durations.ts yearly forever
 *   npx tsx test-scripts/test-coupon-durations.ts quarterly once
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const CYCLE_MONTHS = {
  monthly: 1,
  quarterly: 3,
  semiannually: 6,
  yearly: 12,
} as const;

type Cycle = keyof typeof CYCLE_MONTHS;

const BASE_AMOUNT = 5000; // $50.00 before discount and GST
const PERIODS = 5; // how many renewals to simulate after signup

const money = (n?: number | null) => `$${((n ?? 0) / 100).toFixed(2)}`;
const day = (t?: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "never");

async function settle(clockId: string, frozen_time: number) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time });
  for (let i = 0; i < 120; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return;
    if (clock.status === "internal_failure") throw new Error("test clock failed");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("test clock did not settle in time");
}

async function chargeOnce(customerId: string, taxRateId: string, label: string) {
  const draft = await stripe.invoices.create({ customer: customerId, auto_advance: false });
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draft.id,
    amount: BASE_AMOUNT,
    currency: "cad",
    description: "Membership renewal",
    tax_rates: [taxRateId],
  });
  const invoice = await stripe.invoices.finalizeInvoice(draft.id!);
  const discount = (invoice.total_discount_amounts ?? []).reduce((s, x) => s + x.amount, 0);

  console.log(
    `  ${label.padEnd(26)} base ${money(invoice.subtotal)}  disc -${money(discount)}  ` +
      `total ${money(invoice.total)}   ${discount > 0 ? "DISCOUNTED" : "full price"}`,
  );
  return discount > 0;
}

async function main() {
  const cycle = (process.argv[2] ?? "monthly") as Cycle;
  const durationArg = process.argv[3] ?? "6";

  if (!(cycle in CYCLE_MONTHS)) {
    console.error(`Unknown cycle "${cycle}". Use one of: ${Object.keys(CYCLE_MONTHS).join(", ")}`);
    process.exit(1);
  }
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    console.error("Refusing to run: this creates real objects, so it needs a sk_test_ key.");
    process.exit(1);
  }

  const cycleMonths = CYCLE_MONTHS[cycle];
  const couponConfig: Stripe.CouponCreateParams =
    durationArg === "forever"
      ? { percent_off: 50, duration: "forever", name: "PROBE forever" }
      : durationArg === "once"
        ? { percent_off: 50, duration: "once", name: "PROBE once" }
        : {
            percent_off: 50,
            duration: "repeating",
            duration_in_months: Number(durationArg),
            name: `PROBE ${durationArg} months`,
          };

  const start = new Date("2026-01-10T12:00:00Z");
  const startTs = Math.floor(start.getTime() / 1000);

  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: startTs,
    name: `coupon ${durationArg} x ${cycle}`,
  });
  const coupon = await stripe.coupons.create(couponConfig);
  const gst = await stripe.taxRates.create({
    display_name: "GST",
    percentage: 5,
    inclusive: false,
    country: "CA",
    jurisdiction: "CA",
    metadata: { portal: "probe" },
  });
  const customer = await stripe.customers.create({
    email: "coupon-probe@example.com",
    test_clock: clock.id,
    coupon: coupon.id,
  });

  const discount = ((await stripe.customers.retrieve(customer.id)) as Stripe.Customer).discount;

  console.log(
    `\nCycle: ${cycle} (every ${cycleMonths} month${cycleMonths > 1 ? "s" : ""})  |  ` +
      `Coupon: 50% off, duration=${durationArg}`,
  );
  console.log(`Signup ${day(startTs)}  |  discount ends ${day(discount?.end)}\n`);

  let discounted = 0;
  if (await chargeOnce(customer.id, gst.id, `signup    ${day(startTs)}`)) discounted++;

  for (let i = 1; i <= PERIODS; i++) {
    const next = new Date(start);
    next.setMonth(next.getMonth() + cycleMonths * i);
    // Renewals are charged by the midnight cron, i.e. just after the due moment.
    next.setHours(next.getHours() + 1);
    const ts = Math.floor(next.getTime() / 1000);

    await settle(clock.id, ts);
    if (await chargeOnce(customer.id, gst.id, `renewal ${i} ${day(ts)}`)) discounted++;
  }

  console.log(
    `\n=> ${discounted} of ${PERIODS + 1} payments discounted ` +
      `(${cycle} cycle, duration=${durationArg}).\n`,
  );

  await stripe.testHelpers.testClocks.del(clock.id);
  await stripe.coupons.del(coupon.id);
  await stripe.taxRates.update(gst.id, { active: false });
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
