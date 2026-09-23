import "tests/fixtures/membership/setup";

import {
  getMembershipMocks,
  resetMembershipMocks,
} from "tests/fixtures/membership/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockMembership,
  createMockPlan,
  createMockUser,
  createMockPaymentInformation,
} from "tests/fixtures/membership/memberships";
import type { MembershipDbMock } from "tests/fixtures/membership/setup";
import {
  startMonthlyMembershipCheck,
  cancelMembership,
  revokeUserMembershipByAdmin,
} from "~/models/membership.server";

/**
 * A recurring discount must not outlive the membership it was granted for.
 *
 * There are more ways out of a membership than the cron's three inactive branches:
 * cancelling after the cycle has ended deletes the row outright, and an admin revoke
 * never passes through "inactive" at all. Each exit gets a case here.
 */
describe("membership.server - a discount does not outlive its membership", () => {
  const baseNow = new Date("2025-05-06T00:00:00Z");
  let db: MembershipDbMock;
  let mocks: ReturnType<typeof getMembershipMocks>;
  let clearMembershipDiscountMock: jest.Mock;
  let getCustomerDiscountMock: jest.Mock;
  let getCouponDetailsMock: jest.Mock;

  const runCron = async () => {
    startMonthlyMembershipCheck();
    const job = mocks.scheduledJobs[mocks.scheduledJobs.length - 1];
    await Promise.resolve(job.execution);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseNow);
    clearAllMocks();
    resetMembershipMocks();
    mocks = getMembershipMocks();
    db = mocks.db;
    clearMembershipDiscountMock = (mocks as any).clearMembershipDiscountMock;
    getCustomerDiscountMock = (mocks as any).getCustomerDiscountMock;
    getCouponDetailsMock = (mocks as any).getCouponDetailsMock;
    mocks.resetScheduledJobs();
    mocks.resetEmailMocks();
    mocks.mockGetAdminSetting.mockResolvedValue("5");
    db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
    db.user.update.mockResolvedValue({});
    db.userMembership.count.mockResolvedValue(0);
    db.userPaymentInformation.findUnique.mockResolvedValue(
      createMockPaymentInformation({ userId: 7 })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const dueMembership = (over: Record<string, unknown> = {}) => {
    const plan = createMockPlan({ id: 2, price: 90 });
    return createMockMembership({
      id: 2,
      userId: 7,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: baseNow,
      membershipPlan: plan,
      ...over,
    });
  };

  describe("the cron's three exits", () => {
    it("ends the discount when a membership lapses for want of a saved card", async () => {
      const membership = dueMembership();
      db.userMembership.findMany
        .mockResolvedValueOnce([membership])
        .mockResolvedValueOnce([]);
      db.user.findUnique.mockResolvedValue(
        createMockUser({ id: 7, email: "no-card@example.com", roleLevel: 3 })
      );
      db.userPaymentInformation.findUnique.mockResolvedValue(null);
      db.userMembership.update.mockResolvedValue({
        ...membership,
        status: "inactive",
      });
      db.userMembership.findFirst.mockResolvedValue(null);

      await runCron();

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });

    it("ends the discount when auto-renew was off and the term ran out", async () => {
      const membership = dueMembership({ autoRenew: false });
      db.userMembership.findMany
        .mockResolvedValueOnce([membership])
        .mockResolvedValueOnce([]);
      db.user.findUnique.mockResolvedValue(
        createMockUser({ id: 7, roleLevel: 3 })
      );
      db.userMembership.update.mockResolvedValue({
        ...membership,
        status: "inactive",
      });
      db.userMembership.findFirst.mockResolvedValue(null);

      await runCron();

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });

    it.each(["ending", "cancelled"])(
      "ends the discount when a %s membership reaches its term",
      async (status) => {
        const membership = dueMembership({ status });
        db.userMembership.findMany
          .mockResolvedValueOnce([membership])
          .mockResolvedValueOnce([]);
        db.user.findUnique.mockResolvedValue(
          createMockUser({ id: 7, roleLevel: 3 })
        );
        db.userMembership.update.mockResolvedValue({
          ...membership,
          status: "inactive",
        });
        db.userMembership.findFirst.mockResolvedValue(null);

        await runCron();

        expect(clearMembershipDiscountMock).toHaveBeenCalled();
      }
    );

    // Cycle should make no difference: every cycle funnels through the same branches.
    it.each(["monthly", "quarterly", "semiannually", "yearly"])(
      "ends the discount on a lapsed %s membership",
      async (billingCycle) => {
        const membership = dueMembership({ billingCycle });
        db.userMembership.findMany
          .mockResolvedValueOnce([membership])
          .mockResolvedValueOnce([]);
        db.user.findUnique.mockResolvedValue(
          createMockUser({ id: 7, roleLevel: 3 })
        );
        db.userPaymentInformation.findUnique.mockResolvedValue(null);
        db.userMembership.update.mockResolvedValue({
          ...membership,
          status: "inactive",
        });
        db.userMembership.findFirst.mockResolvedValue(null);

        await runCron();

        expect(clearMembershipDiscountMock).toHaveBeenCalled();
      }
    );
  });

  // The guard that matters: a member can hold an active row AND an ending row at the
  // same time after an upgrade. The coupon lives on the Stripe customer, so clearing it
  // when the ending row lapses would silently kill the discount on the live membership.
  describe("a member who still has another active membership", () => {
    it("keeps the discount when an ending row lapses but an active one remains", async () => {
      const membership = dueMembership({ status: "ending" });
      db.userMembership.findMany
        .mockResolvedValueOnce([membership])
        .mockResolvedValueOnce([]);
      db.user.findUnique.mockResolvedValue(
        createMockUser({ id: 7, roleLevel: 3 })
      );
      db.userMembership.update.mockResolvedValue({
        ...membership,
        status: "inactive",
      });
      db.userMembership.findFirst.mockResolvedValue(null);
      // A surviving active membership on a plan the coupon covers.
      db.userMembership.findMany.mockResolvedValue([
        { membershipPlan: { stripeProductId: "prod_member" } },
      ]);
      getCustomerDiscountMock.mockResolvedValue({ couponId: "co_1" });
      getCouponDetailsMock.mockResolvedValue(
        new Map([["co_1", { couponId: "co_1", appliesToProducts: ["prod_member"] }]])
      );

      await runCron();

      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("excludes the membership being ended when looking for survivors", async () => {
      const membership = dueMembership({ status: "ending" });
      db.userMembership.findMany
        .mockResolvedValueOnce([membership])
        .mockResolvedValueOnce([]);
      db.user.findUnique.mockResolvedValue(
        createMockUser({ id: 7, roleLevel: 3 })
      );
      db.userMembership.update.mockResolvedValue({
        ...membership,
        status: "inactive",
      });
      db.userMembership.findFirst.mockResolvedValue(null);

      await runCron();

      expect(db.userMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: membership.userId,
            status: "active",
            id: { not: membership.id },
          },
        })
      );
    });
  });

  // Keeping a discount alive for a surviving membership is only right if the coupon can
  // actually discount that membership. A coupon scoped to the plan that just ended is
  // dormant: it discounts nothing, is invisible in the admin list, and would spring back
  // if the member ever rejoined the old plan.
  describe("whether a surviving membership can actually use the coupon", () => {
    // The cron reads findMany twice (due list, then reminders) before the guard reads it
    // a third time, so the survivor has to be queued in that order rather than blanket
    // mocked, or it answers the due query instead.
    const lapseWithSurvivor = async (survivingProductId: string | null) => {
      const membership = dueMembership({ status: "ending" });
      db.userMembership.findMany
        .mockResolvedValueOnce([membership])
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          { membershipPlan: { stripeProductId: survivingProductId } },
        ]);
      db.userMembership.findFirst.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(
        createMockUser({ id: 7, roleLevel: 3 })
      );
      db.userMembership.update.mockResolvedValue({
        ...membership,
        status: "inactive",
      });
      await runCron();
    };

    const couponScopedTo = (products: string[] | null) =>
      getCouponDetailsMock.mockResolvedValue(
        new Map([["co_scoped", { couponId: "co_scoped", appliesToProducts: products }]])
      );

    beforeEach(() => {
      getCustomerDiscountMock.mockResolvedValue({ couponId: "co_scoped" });
      db.userPaymentInformation.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
      });
    });

    it("keeps an unscoped coupon, which covers whatever they still hold", async () => {
      couponScopedTo(null);

      await lapseWithSurvivor("prod_dropin");

      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("keeps a scoped coupon that covers a surviving membership", async () => {
      couponScopedTo(["prod_member"]);

      await lapseWithSurvivor("prod_member");

      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("ends a scoped coupon that covers none of the surviving memberships", async () => {
      couponScopedTo(["prod_member"]);

      await lapseWithSurvivor("prod_dropin");

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });

    it("ends it when the surviving plan has no Stripe product to match", async () => {
      couponScopedTo(["prod_member"]);

      await lapseWithSurvivor(null);

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });

    // Unreadable is not the same as unusable, and destroying a working discount is the
    // worse mistake, so an unknown coupon is left alone.
    it("keeps the discount when Stripe cannot be read", async () => {
      getCouponDetailsMock.mockResolvedValue(new Map());

      await lapseWithSurvivor("prod_dropin");

      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("ends it when no discount is attached at all", async () => {
      getCustomerDiscountMock.mockResolvedValue(null);

      await lapseWithSurvivor("prod_member");

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });
  });

  // Cancelling once the paid term is already over deletes the row outright, so there is
  // no "inactive" transition to hook and no mirror row left to show the stale coupon.
  describe("cancelling after the cycle has ended, which deletes the row", () => {
    const setupExpiredCancel = () => {
      const plan = createMockPlan({ id: 3 });
      const record = createMockMembership({
        id: 9,
        userId: 11,
        membershipPlanId: plan.id,
        status: "active",
        nextPaymentDate: new Date("2025-05-01T00:00:00Z"), // already past
        membershipPlan: plan,
      });
      db.userMembership.findFirst.mockResolvedValue(record);
      db.userMembership.delete.mockResolvedValue(record);
      db.userWorkshop.count.mockResolvedValue(0);
      db.userPaymentInformation.findUnique.mockResolvedValue(
        createMockPaymentInformation({ userId: 11 })
      );
      db.userMembership.count.mockResolvedValue(0);
      return record;
    };

    it("ends the discount", async () => {
      const record = setupExpiredCancel();

      await cancelMembership(record.userId, record.membershipPlanId);

      expect(db.userMembership.delete).toHaveBeenCalled();
      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });

    it("keeps it when a remaining active membership can still use the coupon", async () => {
      const record = setupExpiredCancel();
      db.userMembership.findMany.mockResolvedValue([
        { membershipPlan: { stripeProductId: "prod_member" } },
      ]);
      getCustomerDiscountMock.mockResolvedValue({ couponId: "co_scoped" });
      getCouponDetailsMock.mockResolvedValue(
        new Map([
          ["co_scoped", { couponId: "co_scoped", appliesToProducts: ["prod_member"] }],
        ])
      );

      await cancelMembership(record.userId, record.membershipPlanId);

      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });

    it("ends it when the remaining membership is on a plan the coupon does not cover", async () => {
      const record = setupExpiredCancel();
      db.userMembership.findMany.mockResolvedValue([
        { membershipPlan: { stripeProductId: "prod_dropin" } },
      ]);
      getCustomerDiscountMock.mockResolvedValue({ couponId: "co_scoped" });
      getCouponDetailsMock.mockResolvedValue(
        new Map([
          ["co_scoped", { couponId: "co_scoped", appliesToProducts: ["prod_member"] }],
        ])
      );

      await cancelMembership(record.userId, record.membershipPlanId);

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });
  });

  // Cancelling mid-term leaves them a member until the term ends, so the discount stays
  // until the cron retires the row.
  it("keeps the discount when cancelling before the cycle ends", async () => {
    const plan = createMockPlan({ id: 4 });
    const record = createMockMembership({
      id: 12,
      userId: 13,
      membershipPlanId: plan.id,
      status: "active",
      nextPaymentDate: new Date("2025-06-01T00:00:00Z"), // still in the future
      membershipPlan: plan,
    });
    db.userMembership.findFirst.mockResolvedValue(record);
    db.userMembership.update.mockResolvedValue({
      ...record,
      status: "cancelled",
    });

    await cancelMembership(record.userId, record.membershipPlanId);

    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: record.id },
      data: { status: "cancelled" },
    });
    expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
  });

  // Revoking never passes through "inactive", and unrevoking does not restore the rows,
  // so the discount has to be ended here or it never is.
  describe("an admin revoking a membership", () => {
    beforeEach(() => {
      db.$transaction.mockImplementation(async (callback: any) => callback(db));
    });

    it("ends the discount", async () => {
      db.user.findUnique.mockResolvedValue({
        id: 21,
        email: "revoked@example.com",
        firstName: "Rev",
        lastName: "Oked",
        membershipStatus: "active",
      });
      db.userMembership.findMany.mockResolvedValue([
        { id: 31, membershipPlanId: 5, status: "active" },
      ]);
      db.userMembership.updateMany.mockResolvedValue({ count: 1 });
      db.userWorkshop.count.mockResolvedValue(0);
      db.userPaymentInformation.findUnique.mockResolvedValue(
        createMockPaymentInformation({ userId: 21 })
      );

      await revokeUserMembershipByAdmin(21, "non-payment");

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
    });

    it("does nothing to a user who had no revocable membership", async () => {
      db.user.findUnique.mockResolvedValue({
        id: 22,
        email: "none@example.com",
        firstName: "No",
        lastName: "Member",
        membershipStatus: "active",
      });
      db.userMembership.findMany.mockResolvedValue([]);
      db.userWorkshop.count.mockResolvedValue(0);

      await revokeUserMembershipByAdmin(22, "no membership");

      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });
  });
});
