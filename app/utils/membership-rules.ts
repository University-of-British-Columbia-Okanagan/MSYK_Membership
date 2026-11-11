/**
 * Membership purchase rules shared by the checkout, the plan-change routes and
 * registerMembershipSubscription(), so each path refuses the same things.
 */

export type BillingCycle = "monthly" | "quarterly" | "semiannually" | "yearly";

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "monthly",
  quarterly: "quarterly",
  semiannually: "semiannual",
  yearly: "yearly",
};

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === "string" && value in BILLING_CYCLE_LABELS;
}

/** A refusal whose message is safe to show the member. */
export class MembershipChangeError extends Error {}

/**
 * What the plan charges per `cycle`, or null when the plan has no price for
 * that cycle (or the cycle does not exist). Never falls back to the monthly price.
 */
export function getPlanPriceForCycle(
  plan: {
    price: number;
    price3Months?: number | null;
    price6Months?: number | null;
    priceYearly?: number | null;
  },
  cycle: string,
): number | null {
  switch (cycle) {
    case "monthly":
      return plan.price;
    case "quarterly":
      return plan.price3Months ?? null;
    case "semiannually":
      return plan.price6Months ?? null;
    case "yearly":
      return plan.priceYearly ?? null;
    default:
      return null;
  }
}

/** The payment page's needAdminPermission gate: level 3 or above plus admin permission. */
export function assertPlanPermission(
  user: { roleLevel: number; allowLevel4?: boolean | null },
  plan: { needAdminPermission?: boolean | null },
) {
  if (plan.needAdminPermission && !(user.roleLevel >= 3 && user.allowLevel4 === true)) {
    throw new MembershipChangeError(
      "This membership plan requires admin approval. Please contact the Makerspace.",
    );
  }
}
