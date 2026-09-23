import "tests/fixtures/membership/setup";

import {
  getMembershipMocks,
  resetMembershipMocks,
} from "tests/fixtures/membership/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import type { MembershipDbMock } from "tests/fixtures/membership/setup";
import {
  applyRecurringDiscountToMember,
  listDiscountEligibleMembers,
} from "~/models/membership.server";

/** A coupon as resolveDiscountCode hands it back: unscoped, unrestricted, valid. */
const resolved = (over: Record<string, unknown> = {}) => ({
  couponId: "co_1",
  promotionCodeId: "promo_1",
  couponName: "Half off",
  percentOff: 50,
  amountOff: null,
  duration: "repeating",
  durationInMonths: 6,
  valid: true,
  appliesToProducts: null,
  blockingRestrictions: [],
  ...over,
});

const activeMembership = (over: Record<string, unknown> = {}) => ({
  id: 77,
  userId: 5,
  status: "active",
  nextPaymentDate: new Date("2026-10-14T00:00:00Z"),
  billingCycle: "monthly",
  stripeCouponId: null,
  membershipPlan: {
    id: 3,
    title: "Makerspace Member",
    stripeProductId: "prod_member",
  },
  ...over,
});

describe("membership.server - applying a recurring discount to an existing member", () => {
  let db: MembershipDbMock;
  let resolveDiscountCodeMock: jest.Mock;
  let applyMembershipDiscountMock: jest.Mock;
  let getOrCreateStripeCustomerMock: jest.Mock;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    clearAllMocks();
    resetMembershipMocks();
    ({
      db,
      resolveDiscountCodeMock,
      applyMembershipDiscountMock,
      getOrCreateStripeCustomerMock,
    } = getMembershipMocks() as any);

    db.userMembership.findFirst.mockResolvedValue(activeMembership());
    db.userPaymentInformation.findUnique.mockResolvedValue({
      stripeCustomerId: "cus_test",
      stripePaymentMethodId: "pm_test",
    });
    resolveDiscountCodeMock.mockResolvedValue(resolved());
    applyMembershipDiscountMock.mockResolvedValue({
      couponId: "co_1",
      endsAt: new Date("2027-04-14T00:00:00Z"),
    });
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  describe("refusals", () => {
    it("refuses a member with no active membership", async () => {
      db.userMembership.findFirst.mockResolvedValue(null);

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("no_active_membership");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("only considers an active membership, not one that is ending", async () => {
      await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(db.userMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 5, status: "active" }),
        })
      );
    });

    it("refuses a code Stripe does not recognise", async () => {
      resolveDiscountCodeMock.mockResolvedValue(null);

      const result = await applyRecurringDiscountToMember(5, "NOPE");

      expect(result.reason).toBe("unknown_code");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("refuses a coupon Stripe no longer considers valid", async () => {
      resolveDiscountCodeMock.mockResolvedValue(resolved({ valid: false }));

      const result = await applyRecurringDiscountToMember(5, "SPENT");

      expect(result.reason).toBe("code_not_valid");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    // Stripe rejects these outright on a customer, so catching them here turns a raw
    // Stripe error into something an admin can act on.
    it("refuses a promotion code carrying restrictions, naming them", async () => {
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ blockingRestrictions: ["minimum_amount"] })
      );

      const result = await applyRecurringDiscountToMember(5, "MIN50");

      expect(result.reason).toBe("code_restricted");
      expect(result.message).toMatch(/minimum/i);
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    // The bug this guard exists for: Stripe ignores a product-scoped coupon on an
    // invoice line for a different product, charges full price, and reports success.
    it("refuses a coupon scoped to a product the member's plan is not", async () => {
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ appliesToProducts: ["prod_other"] })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("product_mismatch");
      expect(result.message).toContain("Makerspace Member");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("refuses a scoped coupon when the member's plan has never been synced to Stripe", async () => {
      db.userMembership.findFirst.mockResolvedValue(
        activeMembership({
          membershipPlan: {
            id: 3,
            title: "Makerspace Member",
            stripeProductId: null,
          },
        })
      );
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ appliesToProducts: ["prod_member"] })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.reason).toBe("plan_not_synced");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("reports a Stripe failure rather than claiming success", async () => {
      applyMembershipDiscountMock.mockResolvedValue(null);

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("stripe_error");
    });

    it("refuses a blank code without touching Stripe", async () => {
      const result = await applyRecurringDiscountToMember(5, "   ");

      expect(result.reason).toBe("unknown_code");
      expect(resolveDiscountCodeMock).not.toHaveBeenCalled();
      expect(getOrCreateStripeCustomerMock).not.toHaveBeenCalled();
    });
  });

  describe("applying", () => {
    it("redeems the promotion code against the member's Stripe customer", async () => {
      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(getOrCreateStripeCustomerMock).toHaveBeenCalledWith(5);
      expect(applyMembershipDiscountMock).toHaveBeenCalledWith(
        "cus_test",
        "co_1",
        77,
        "promo_1"
      );
      expect(result.ok).toBe(true);
      expect(result.couponId).toBe("co_1");
    });

    it("applies an unscoped coupon whatever plan the member is on", async () => {
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ appliesToProducts: null })
      );
      db.userMembership.findFirst.mockResolvedValue(
        activeMembership({
          membershipPlan: {
            id: 9,
            title: "Drop-In 10 Pass",
            stripeProductId: "prod_dropin",
          },
        })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(true);
    });

    it("applies a scoped coupon when it covers the member's plan", async () => {
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ appliesToProducts: ["prod_other", "prod_member"] })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(true);
      expect(applyMembershipDiscountMock).toHaveBeenCalled();
    });

    it("applies a bare coupon id with no promotion code to redeem", async () => {
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ promotionCodeId: null })
      );

      await applyRecurringDiscountToMember(5, "co_1");

      expect(applyMembershipDiscountMock).toHaveBeenCalledWith(
        "cus_test",
        "co_1",
        77,
        null
      );
    });

    // Nothing is refunded for the period already paid, so the admin needs to see the
    // date the discount first bites.
    it("reports the renewal date the discount first applies to", async () => {
      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.firstDiscountedChargeOn).toEqual(
        new Date("2026-10-14T00:00:00Z")
      );
    });

    it("reports the coupon it replaced when the member already had one", async () => {
      db.userMembership.findFirst.mockResolvedValue(
        activeMembership({ stripeCouponId: "co_old" })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(true);
      expect(result.replacedCouponId).toBe("co_old");
    });

    it("flags a member with no saved card, whose renewal will not be charged at all", async () => {
      db.userPaymentInformation.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_test",
        stripePaymentMethodId: null,
      });

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(true);
      expect(result.hasSavedCard).toBe(false);
    });

    it("reports a saved card when the member has one", async () => {
      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.hasSavedCard).toBe(true);
    });
  });

  // Applying is deliberately cycle-independent: the coupon goes on the Stripe customer,
  // and the cycle only decides which plan price the renewal invoice carries. These guard
  // against someone later making the apply path care about the cycle.
  describe("billing cycles", () => {
    it.each([
      ["monthly", new Date("2026-10-14T00:00:00Z")],
      ["quarterly", new Date("2026-12-14T00:00:00Z")],
      ["semiannually", new Date("2027-03-14T00:00:00Z")],
      ["yearly", new Date("2027-09-14T00:00:00Z")],
    ])("applies to a %s membership", async (billingCycle, nextPaymentDate) => {
      db.userMembership.findFirst.mockResolvedValue(
        activeMembership({ billingCycle, nextPaymentDate })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(true);
      expect(applyMembershipDiscountMock).toHaveBeenCalledWith(
        "cus_test",
        "co_1",
        77,
        "promo_1"
      );
      expect(result.firstDiscountedChargeOn).toEqual(nextPaymentDate);
    });

    it.each(["monthly", "quarterly", "semiannually", "yearly"])(
      "refuses a product-mismatched coupon on a %s membership too",
      async (billingCycle) => {
        db.userMembership.findFirst.mockResolvedValue(
          activeMembership({ billingCycle })
        );
        resolveDiscountCodeMock.mockResolvedValue(
          resolved({ appliesToProducts: ["prod_other"] })
        );

        const result = await applyRecurringDiscountToMember(5, "SUMMER50");

        expect(result.reason).toBe("product_mismatch");
        expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
      }
    );
  });

  // A member can hold more than one active membership. The admin picks a specific one in
  // the UI, and the product check must run against THAT plan: picking Drop-In and having
  // it validated against Makerspace Member is how a scoped coupon slips past the guard.
  describe("choosing between several active memberships", () => {
    it("uses the membership the admin selected", async () => {
      const chosen = activeMembership({
        id: 88,
        membershipPlan: {
          id: 9,
          title: "Drop-In 10 Pass",
          stripeProductId: "prod_dropin",
        },
      });
      db.userMembership.findFirst.mockResolvedValue(chosen);

      await applyRecurringDiscountToMember(5, "SUMMER50", 88);

      expect(db.userMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 5, status: "active", id: 88 }),
        })
      );
      expect(applyMembershipDiscountMock).toHaveBeenCalledWith(
        "cus_test",
        "co_1",
        88,
        "promo_1"
      );
    });

    it("refuses a coupon that does not cover the selected membership's plan", async () => {
      db.userMembership.findFirst.mockResolvedValue(
        activeMembership({
          id: 88,
          membershipPlan: {
            id: 9,
            title: "Drop-In 10 Pass",
            stripeProductId: "prod_dropin",
          },
        })
      );
      resolveDiscountCodeMock.mockResolvedValue(
        resolved({ appliesToProducts: ["prod_member"] })
      );

      const result = await applyRecurringDiscountToMember(5, "SUMMER50", 88);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("product_mismatch");
      expect(result.message).toContain("Drop-In 10 Pass");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("refuses a membership id that is not the member's own active one", async () => {
      db.userMembership.findFirst.mockResolvedValue(null);

      const result = await applyRecurringDiscountToMember(5, "SUMMER50", 999);

      expect(result.reason).toBe("no_active_membership");
      expect(applyMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("still works with no membership id, for a member with only one", async () => {
      const result = await applyRecurringDiscountToMember(5, "SUMMER50");

      expect(result.ok).toBe(true);
      expect(db.userMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 5, status: "active" },
        })
      );
    });
  });
});

describe("membership.server - listDiscountEligibleMembers", () => {
  let db: MembershipDbMock;

  beforeEach(() => {
    clearAllMocks();
    resetMembershipMocks();
    ({ db } = getMembershipMocks() as any);
  });

  it("asks only for active memberships", async () => {
    db.userMembership.findMany.mockResolvedValue([]);

    await listDiscountEligibleMembers();

    expect(db.userMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "active" } })
    );
  });

  it("returns the fields the picker and the product check both need", async () => {
    db.userMembership.findMany.mockResolvedValue([
      {
        id: 77,
        userId: 5,
        status: "active",
        nextPaymentDate: new Date("2026-10-14T00:00:00Z"),
        billingCycle: "monthly",
        stripeCouponId: "co_old",
        user: {
          id: 5,
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          paymentInformation: { stripePaymentMethodId: "pm_1" },
        },
        membershipPlan: {
          id: 3,
          title: "Makerspace Member",
          stripeProductId: "prod_member",
        },
      },
    ]);

    const rows = await listDiscountEligibleMembers();

    expect(rows).toEqual([
      {
        userId: 5,
        membershipId: 77,
        memberName: "Ada Lovelace",
        email: "ada@example.com",
        planTitle: "Makerspace Member",
        planProductId: "prod_member",
        billingCycle: "monthly",
        nextPaymentDate: new Date("2026-10-14T00:00:00Z"),
        currentCouponId: "co_old",
        hasSavedCard: true,
      },
    ]);
  });

  it("reports no saved card when the member has no payment information row", async () => {
    db.userMembership.findMany.mockResolvedValue([
      {
        id: 78,
        userId: 6,
        status: "active",
        nextPaymentDate: new Date("2026-11-01T00:00:00Z"),
        billingCycle: "monthly",
        stripeCouponId: null,
        user: {
          id: 6,
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@example.com",
          paymentInformation: null,
        },
        membershipPlan: { id: 3, title: "Makerspace Member", stripeProductId: null },
      },
    ]);

    const rows = await listDiscountEligibleMembers();

    expect(rows[0].hasSavedCard).toBe(false);
    expect(rows[0].planProductId).toBeNull();
  });
});
