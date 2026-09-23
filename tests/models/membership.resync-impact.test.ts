import "tests/fixtures/membership/setup";

import {
  getMembershipMocks,
  resetMembershipMocks,
} from "tests/fixtures/membership/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import type { MembershipDbMock } from "tests/fixtures/membership/setup";
import {
  listProductScopedDiscounts,
  clearOrphanedScopedDiscounts,
} from "~/models/membership.server";

const couponDetail = (over: Record<string, unknown> = {}) => ({
  couponId: "co_scoped",
  appliesToProducts: ["prod_member"],
  percentOff: 50,
  amountOff: null,
  duration: "forever",
  durationInMonths: null,
  promotionCodes: ["WINTER50"],
  ...over,
});

const membershipRow = (over: Record<string, unknown> = {}) => ({
  id: 77,
  userId: 5,
  status: "active",
  billingCycle: "monthly",
  stripeCouponId: "co_scoped",
  discountEndsAt: null,
  user: {
    id: 5,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  },
  membershipPlan: { title: "Makerspace Member", stripeProductId: "prod_member" },
  ...over,
});

describe("membership.server - Clear and Re-sync impact on discounts", () => {
  let db: MembershipDbMock;
  let getCouponDetailsMock: jest.Mock;
  let clearMembershipDiscountMock: jest.Mock;
  let loggerInfoMock: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    resetMembershipMocks();
    const mocks = getMembershipMocks() as any;
    db = mocks.db;
    getCouponDetailsMock = mocks.getCouponDetailsMock;
    clearMembershipDiscountMock = mocks.clearMembershipDiscountMock;
    loggerInfoMock = mocks.loggerInfoMock;
  });

  describe("listProductScopedDiscounts", () => {
    it("returns nothing when no member holds a coupon", async () => {
      db.userMembership.findMany.mockResolvedValue([]);

      await expect(listProductScopedDiscounts()).resolves.toEqual([]);
      expect(getCouponDetailsMock).not.toHaveBeenCalled();
    });

    it("lists a member whose coupon is limited to specific products", async () => {
      db.userMembership.findMany.mockResolvedValue([membershipRow()]);
      getCouponDetailsMock.mockResolvedValue(
        new Map([["co_scoped", couponDetail()]])
      );

      const rows = await listProductScopedDiscounts();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: 5,
        memberName: "Ada Lovelace",
        planTitle: "Makerspace Member",
        couponId: "co_scoped",
        promotionCode: "WINTER50",
        discountLabel: "50% off",
        durationLabel: "forever",
      });
    });

    // An unscoped coupon matches whatever product the renewal carries, so a re-sync
    // leaves it working. Listing it would mean destroying a healthy discount.
    it("leaves out an unscoped coupon, which a re-sync cannot break", async () => {
      db.userMembership.findMany.mockResolvedValue([membershipRow()]);
      getCouponDetailsMock.mockResolvedValue(
        new Map([["co_scoped", couponDetail({ appliesToProducts: null })]])
      );

      await expect(listProductScopedDiscounts()).resolves.toEqual([]);
    });

    // Missing means Stripe could not be read, which is not the same as "safe".
    it("leaves out a coupon Stripe could not be read for", async () => {
      db.userMembership.findMany.mockResolvedValue([membershipRow()]);
      getCouponDetailsMock.mockResolvedValue(new Map());

      await expect(listProductScopedDiscounts()).resolves.toEqual([]);
    });

    it("only considers memberships that are still live", async () => {
      db.userMembership.findMany.mockResolvedValue([]);

      await listProductScopedDiscounts();

      expect(db.userMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stripeCouponId: { not: null },
            status: { in: ["active", "ending"] },
          }),
        })
      );
    });

    it("deduplicates the coupon lookup across members sharing a code", async () => {
      db.userMembership.findMany.mockResolvedValue([
        membershipRow({ id: 1, userId: 1 }),
        membershipRow({ id: 2, userId: 2 }),
        membershipRow({ id: 3, userId: 3 }),
      ]);
      getCouponDetailsMock.mockResolvedValue(
        new Map([["co_scoped", couponDetail()]])
      );

      const rows = await listProductScopedDiscounts();

      expect(rows).toHaveLength(3);
      expect(getCouponDetailsMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["forever", null, "forever"],
      ["once", null, "one payment"],
      ["repeating", 6, "6 months"],
    ])(
      "describes a %s coupon as %s months -> %s",
      async (duration, months, expected) => {
        db.userMembership.findMany.mockResolvedValue([membershipRow()]);
        getCouponDetailsMock.mockResolvedValue(
          new Map([
            [
              "co_scoped",
              couponDetail({ duration, durationInMonths: months }),
            ],
          ])
        );

        const rows = await listProductScopedDiscounts();

        expect(rows[0].durationLabel).toBe(expected);
      }
    );

    it("describes an amount-off coupon in dollars", async () => {
      db.userMembership.findMany.mockResolvedValue([membershipRow()]);
      getCouponDetailsMock.mockResolvedValue(
        new Map([
          ["co_scoped", couponDetail({ percentOff: null, amountOff: 1500 })],
        ])
      );

      const rows = await listProductScopedDiscounts();

      expect(rows[0].discountLabel).toBe("$15.00 off");
    });

    it("reports a missing promotion code as null rather than inventing one", async () => {
      db.userMembership.findMany.mockResolvedValue([membershipRow()]);
      getCouponDetailsMock.mockResolvedValue(
        new Map([["co_scoped", couponDetail({ promotionCodes: [] })]])
      );

      const rows = await listProductScopedDiscounts();

      expect(rows[0].promotionCode).toBeNull();
    });
  });

  describe("clearOrphanedScopedDiscounts", () => {
    const impact = [
      {
        userId: 5,
        membershipId: 77,
        memberName: "Ada Lovelace",
        email: "ada@example.com",
        planTitle: "Makerspace Member",
        planProductId: "prod_member",
        billingCycle: "monthly",
        couponId: "co_scoped",
        promotionCode: "WINTER50",
        discountLabel: "50% off",
        durationLabel: "forever",
        discountEndsAt: null,
      },
    ];

    it("does nothing, and logs nothing, for an empty list", async () => {
      await expect(clearOrphanedScopedDiscounts([])).resolves.toBe(0);
      expect(loggerInfoMock).not.toHaveBeenCalled();
      expect(clearMembershipDiscountMock).not.toHaveBeenCalled();
    });

    // The download is optional, so the log is the only guaranteed record of who to
    // restore. Losing it would make the change unrecoverable.
    it("writes the worklist to the log before clearing anything", async () => {
      db.userPaymentInformation.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
      });
      db.userMembership.findMany.mockResolvedValue([]);

      await clearOrphanedScopedDiscounts(impact as any);

      expect(loggerInfoMock).toHaveBeenCalledWith(
        expect.stringContaining("Clear and Re-sync"),
        expect.objectContaining({
          count: 1,
          members: [
            expect.objectContaining({
              email: "ada@example.com",
              couponId: "co_scoped",
              promotionCode: "WINTER50",
            }),
          ],
        })
      );
    });

    it("ends the discount for each affected member", async () => {
      db.userPaymentInformation.findUnique.mockResolvedValue({
        stripeCustomerId: "cus_1",
      });
      db.userMembership.findMany.mockResolvedValue([]);
      clearMembershipDiscountMock.mockResolvedValue(true);

      const cleared = await clearOrphanedScopedDiscounts(impact as any);

      expect(clearMembershipDiscountMock).toHaveBeenCalled();
      expect(cleared).toBe(1);
    });
  });
});
