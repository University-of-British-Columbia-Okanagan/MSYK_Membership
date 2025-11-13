type MembershipStatus =
  | "active"
  | "ending"
  | "cancelled"
  | "inactive";

type BillingCycle = "monthly" | "quarterly" | "semiannually" | "yearly";

const defaultDate = new Date("2025-05-06T00:00:00Z");

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const createMockPlan = (
  overrides: Partial<{
    id: number;
    title: string;
    description: string;
    price: number;
    price3Months: number | null;
    price6Months: number | null;
    priceYearly: number | null;
    needAdminPermission: boolean;
    feature: Record<string, string>;
  }> = {}
) => ({
  id: 1,
  title: "Standard Membership",
  description: "Access during open hours",
  price: 120,
  price3Months: null,
  price6Months: null,
  priceYearly: null,
  needAdminPermission: false,
  feature: { Feature1: "Access to makerspace" },
  ...overrides,
});

export const createMockUser = (
  overrides: Partial<{
    id: number;
    email: string;
    roleLevel: number;
    allowLevel4: boolean;
    firstName: string;
    lastName: string;
  }> = {}
) => ({
  id: 1,
  email: "ronit@example.com",
  roleLevel: 2,
  allowLevel4: false,
  firstName: "Ronit",
  lastName: "Buti",
  ...overrides,
});

export const createMockMembership = (
  overrides: Partial<{
    id: number;
    userId: number;
    membershipPlanId: number;
    date: Date;
    nextPaymentDate: Date;
    status: MembershipStatus;
    billingCycle: BillingCycle;
    paymentIntentId: string | null;
    membershipPlan: ReturnType<typeof createMockPlan>;
  }> = {}
) => {
  const date = overrides.date ?? defaultDate;
  const billingCycle = overrides.billingCycle ?? "monthly";
  return {
    id: 10,
    userId: 1,
    membershipPlanId: 1,
    date,
    nextPaymentDate:
      overrides.nextPaymentDate ??
      (billingCycle === "monthly"
        ? addMonths(date, 1)
        : billingCycle === "quarterly"
        ? addMonths(date, 3)
        : billingCycle === "semiannually"
        ? addMonths(date, 6)
        : addMonths(date, 12)),
    status: "active" as MembershipStatus,
    billingCycle,
    paymentIntentId: null,
    membershipPlan: overrides.membershipPlan ?? createMockPlan(),
    ...overrides,
  };
};

export const createMockMembershipForm = (
  overrides: Partial<{
    id: number;
    userId: number;
    membershipPlanId: number;
    status: "pending" | "active" | "inactive" | "cancelled" | "ending";
    agreementSignature: string | null;
    userMembershipId: number | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) => ({
  id: 100,
  userId: 1,
  membershipPlanId: 1,
  status: "pending",
  agreementSignature: "encrypted-pdf",
  userMembershipId: null,
  createdAt: defaultDate,
  updatedAt: defaultDate,
  ...overrides,
});

export const createMockPaymentInformation = (
  overrides: Partial<{
    userId: number;
    stripeCustomerId: string | null;
    stripePaymentMethodId: string | null;
  }> = {}
) => ({
  userId: 1,
  stripeCustomerId: "cus_123",
  stripePaymentMethodId: "pm_123",
  ...overrides,
});

