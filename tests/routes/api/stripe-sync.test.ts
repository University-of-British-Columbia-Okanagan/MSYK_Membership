// session.server throws at import time if SESSION_SECRET is unset, and the route pulls
// it in transitively — so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import { getRoleUser } from "~/utils/session.server";
import { getAdminSetting } from "~/models/admin.server";
import { getOrCreateGstTaxRate } from "~/services/stripe-discounts.server";
import {
  endRecurringDiscountForUser,
  applyRecurringDiscountToMember,
  listDiscountEligibleMembers,
  listProductScopedDiscounts,
  clearOrphanedScopedDiscounts,
} from "~/models/membership.server";
import { bulkSyncToStripe } from "~/services/stripe-sync.server";
import { db } from "~/utils/db.server";
import { action } from "~/routes/api/stripe-sync";

jest.mock("~/utils/session.server");
jest.mock("~/models/admin.server");
jest.mock("~/models/membership.server");
jest.mock("~/services/stripe-discounts.server");
jest.mock("~/services/stripe-sync.server");

const mockGetRoleUser = getRoleUser as jest.Mock;
const mockGetAdminSetting = getAdminSetting as jest.Mock;
const mockGetOrCreateGstTaxRate = getOrCreateGstTaxRate as jest.Mock;
const mockEndRecurringDiscount = endRecurringDiscountForUser as jest.Mock;
const mockApplyRecurringDiscount = applyRecurringDiscountToMember as jest.Mock;
const mockListDiscountEligibleMembers = listDiscountEligibleMembers as jest.Mock;
const mockListProductScopedDiscounts = listProductScopedDiscounts as jest.Mock;
const mockClearOrphanedScopedDiscounts =
  clearOrphanedScopedDiscounts as jest.Mock;
const mockBulkSync = bulkSyncToStripe as jest.Mock;
// The session fixture owns the db.server mock and only stocks `user` and `roleUser`.
// Rather than push membership models into a fixture whose other consumers do not need
// them, extend the mocked client here with just what this route queries.
const mockDb = db as unknown as Record<string, any>;

const post = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return action({
    request: new Request("http://localhost/api/stripe-sync", {
      method: "POST",
      body,
    }),
  });
};

const asAdmin = () =>
  mockGetRoleUser.mockResolvedValue({ userId: 1, roleName: "Admin" });

describe("api/stripe-sync route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSetting.mockResolvedValue("5");
    mockGetOrCreateGstTaxRate.mockResolvedValue("txr_1");
    mockEndRecurringDiscount.mockResolvedValue(true);
    mockApplyRecurringDiscount.mockResolvedValue({ ok: true });
    mockListDiscountEligibleMembers.mockResolvedValue([]);
    mockListProductScopedDiscounts.mockResolvedValue([]);
    mockClearOrphanedScopedDiscounts.mockResolvedValue(0);
    mockBulkSync.mockResolvedValue({
      workshopsSynced: 0,
      membershipPlansSynced: 0,
      equipmentSynced: 0,
      errors: [],
    });
    mockDb.userMembership = { findMany: jest.fn().mockResolvedValue([]) };
    mockDb.workshop = { count: jest.fn().mockResolvedValue(0) };
    mockDb.membershipPlan = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };
    mockDb.equipment = { count: jest.fn().mockResolvedValue(0) };
  });

  describe("authorisation", () => {
    it.each([
      "getDiscountStatus",
      "endDiscount",
      "bulkSync",
      "clearAndResync",
      "listDiscountMembers",
      "applyDiscount",
      "getResyncImpact",
    ])("rejects %s for a non-admin", async (actionType) => {
      mockGetRoleUser.mockResolvedValue({ userId: 2, roleName: "User" });

      const response = await post({ actionType, userId: "5", code: "SUMMER50" });

      expect(response.status).toBe(403);
      expect(mockEndRecurringDiscount).not.toHaveBeenCalled();
      expect(mockBulkSync).not.toHaveBeenCalled();
      expect(mockApplyRecurringDiscount).not.toHaveBeenCalled();
      expect(mockListDiscountEligibleMembers).not.toHaveBeenCalled();
    });

    it("rejects a signed-out visitor", async () => {
      mockGetRoleUser.mockResolvedValue(null);

      const response = await post({ actionType: "endDiscount", userId: "5" });

      expect(response.status).toBe(403);
      expect(mockEndRecurringDiscount).not.toHaveBeenCalled();
    });
  });

  describe("getDiscountStatus", () => {
    it("reports the GST rate and the members currently on a discount", async () => {
      asAdmin();
      const endsAt = new Date("2027-02-26T00:00:00Z");
      mockDb.userMembership.findMany.mockResolvedValue([
        {
          id: 10,
          status: "active",
          stripeCouponId: "co_1",
          discountEndsAt: endsAt,
          user: {
            id: 4,
            firstName: "Test4",
            lastName: "User4",
            email: "testuser4@gmail.com",
          },
          membershipPlan: { title: "Makerspace Member" },
        },
      ]);

      const body = await (await post({ actionType: "getDiscountStatus" })).json();

      expect(body.success).toBe(true);
      expect(body.gst).toEqual({ percentage: 5, taxRateId: "txr_1" });
      expect(body.discounts).toEqual([
        {
          membershipId: 10,
          userId: 4,
          memberName: "Test4 User4",
          email: "testuser4@gmail.com",
          planTitle: "Makerspace Member",
          couponId: "co_1",
          endsAt: endsAt.toISOString(),
          status: "active",
        },
      ]);
    });

    // The mirrored columns are only refreshed when the member is next charged, so a
    // discount Stripe already expired can sit in the table for a whole billing cycle —
    // showing an admin a past "ends" date on someone paying full price.
    it("excludes discounts Stripe has already expired, but keeps forever ones", async () => {
      asAdmin();

      await post({ actionType: "getDiscountStatus" });

      const where = mockDb.userMembership.findMany.mock.calls[0][0].where;
      expect(where.stripeCouponId).toEqual({ not: null });
      expect(where.status).toEqual({ in: ["active", "ending"] });
      expect(where.OR).toEqual([
        { discountEndsAt: null },
        { discountEndsAt: { gt: expect.any(Date) } },
      ]);
    });

    it("only lists memberships that are still active or ending", async () => {
      asAdmin();

      await post({ actionType: "getDiscountStatus" });

      expect(
        mockDb.userMembership.findMany.mock.calls[0][0].where.status
      ).toEqual({ in: ["active", "ending"] });
    });
  });

  describe("endDiscount", () => {
    it("ends the discount for the given member", async () => {
      asAdmin();

      const body = await (
        await post({ actionType: "endDiscount", userId: "4" })
      ).json();

      expect(mockEndRecurringDiscount).toHaveBeenCalledWith(4);
      expect(body).toEqual({ success: true, cleared: true });
    });

    it("rejects a request with no userId rather than clearing someone at random", async () => {
      asAdmin();

      const response = await post({ actionType: "endDiscount" });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(mockEndRecurringDiscount).not.toHaveBeenCalled();
    });

    it("surfaces a Stripe failure instead of reporting success", async () => {
      asAdmin();
      mockEndRecurringDiscount.mockRejectedValue(new Error("stripe down"));

      const response = await post({ actionType: "endDiscount", userId: "4" });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ success: false, error: "stripe down" });
    });
  });

  describe("listDiscountMembers", () => {
    it("returns the active members a discount can be applied to", async () => {
      asAdmin();
      mockListDiscountEligibleMembers.mockResolvedValue([
        {
          userId: 5,
          membershipId: 77,
          memberName: "Ada Lovelace",
          email: "ada@example.com",
          planTitle: "Makerspace Member",
          planProductId: "prod_member",
          billingCycle: "monthly",
          nextPaymentDate: new Date("2026-10-14T00:00:00Z"),
          currentCouponId: null,
          hasSavedCard: true,
        },
      ]);

      const body = await (
        await post({ actionType: "listDiscountMembers" })
      ).json();

      expect(body.success).toBe(true);
      expect(body.members).toHaveLength(1);
      expect(body.members[0]).toMatchObject({
        userId: 5,
        memberName: "Ada Lovelace",
        planTitle: "Makerspace Member",
        hasSavedCard: true,
      });
    });

    it("surfaces a database failure instead of an empty picker", async () => {
      asAdmin();
      mockListDiscountEligibleMembers.mockRejectedValue(new Error("db down"));

      const response = await post({ actionType: "listDiscountMembers" });

      expect(response.status).toBe(500);
      expect((await response.json()).success).toBe(false);
    });
  });

  describe("applyDiscount", () => {
    it("applies the typed code to the chosen member", async () => {
      asAdmin();
      mockApplyRecurringDiscount.mockResolvedValue({
        ok: true,
        couponId: "co_1",
        couponLabel: "50% off",
        endsAt: null,
        firstDiscountedChargeOn: new Date("2026-10-14T00:00:00Z"),
        replacedCouponId: null,
        hasSavedCard: true,
      });

      const body = await (
        await post({ actionType: "applyDiscount", userId: "5", code: "SUMMER50" })
      ).json();

      expect(mockApplyRecurringDiscount).toHaveBeenCalledWith(
        5,
        "SUMMER50",
        undefined
      );
      expect(body.success).toBe(true);
      expect(body.result.couponId).toBe("co_1");
    });

    // The picker lists one row per active membership, so the chosen row has to reach the
    // model: without it the product check runs against a plan the admin did not pick.
    it("forwards the chosen membership so the product check uses that plan", async () => {
      asAdmin();

      await post({
        actionType: "applyDiscount",
        userId: "5",
        membershipId: "88",
        code: "SUMMER50",
      });

      expect(mockApplyRecurringDiscount).toHaveBeenCalledWith(5, "SUMMER50", 88);
    });

    // A refusal is the expected outcome for a mismatched coupon, not a server fault,
    // so it comes back 200 with the reason the admin needs to read.
    it("reports a refusal with its reason and message", async () => {
      asAdmin();
      mockApplyRecurringDiscount.mockResolvedValue({
        ok: false,
        reason: "product_mismatch",
        message: "This coupon is limited to specific Stripe products",
      });

      const response = await post({
        actionType: "applyDiscount",
        userId: "5",
        code: "SUMMER50",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.result.ok).toBe(false);
      expect(body.result.reason).toBe("product_mismatch");
    });

    it("rejects a request with no userId", async () => {
      asAdmin();

      const response = await post({ actionType: "applyDiscount", code: "X" });

      expect(response.status).toBe(400);
      expect(mockApplyRecurringDiscount).not.toHaveBeenCalled();
    });

    it("rejects a request with no code", async () => {
      asAdmin();

      const response = await post({ actionType: "applyDiscount", userId: "5" });

      expect(response.status).toBe(400);
      expect(mockApplyRecurringDiscount).not.toHaveBeenCalled();
    });

    it("surfaces an unexpected failure", async () => {
      asAdmin();
      mockApplyRecurringDiscount.mockRejectedValue(new Error("stripe down"));

      const response = await post({
        actionType: "applyDiscount",
        userId: "5",
        code: "SUMMER50",
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: "stripe down",
      });
    });
  });

  describe("getResyncImpact", () => {
    it("reports the members a Clear and Re-sync would cost their discount", async () => {
      asAdmin();
      mockListProductScopedDiscounts.mockResolvedValue([
        {
          userId: 5,
          membershipId: 77,
          planId: 3,
          memberName: "Ada Lovelace",
          email: "ada@example.com",
          planTitle: "Makerspace Member",
          planProductId: "prod_old",
          billingCycle: "monthly",
          couponId: "co_scoped",
          promotionCode: "WINTER50",
          discountLabel: "50% off",
          durationLabel: "forever",
          discountEndsAt: null,
        },
      ]);

      const body = await (await post({ actionType: "getResyncImpact" })).json();

      expect(body.success).toBe(true);
      expect(body.affected).toHaveLength(1);
      expect(body.affected[0].promotionCode).toBe("WINTER50");
    });

    it("reports an empty list when nothing would break", async () => {
      asAdmin();

      const body = await (await post({ actionType: "getResyncImpact" })).json();

      expect(body).toEqual({ success: true, affected: [] });
    });

    it("surfaces a failure rather than implying nothing is at risk", async () => {
      asAdmin();
      mockListProductScopedDiscounts.mockRejectedValue(new Error("stripe down"));

      const response = await post({ actionType: "getResyncImpact" });

      expect(response.status).toBe(500);
      expect((await response.json()).success).toBe(false);
    });
  });

  describe("clearAndResync", () => {
    const affected = [
      {
        userId: 5,
        membershipId: 77,
        planId: 3,
        memberName: "Ada Lovelace",
        email: "ada@example.com",
        planTitle: "Makerspace Member",
        planProductId: "prod_old",
        billingCycle: "monthly",
        couponId: "co_scoped",
        promotionCode: "WINTER50",
        discountLabel: "50% off",
        durationLabel: "forever",
        discountEndsAt: null,
      },
    ];

    // Reading the impact after the sync would be useless: every plan holds a new product
    // id by then, so there is no way to tell which coupons used to match.
    it("reads the impact before re-syncing, not after", async () => {
      asAdmin();
      const order: string[] = [];
      mockListProductScopedDiscounts.mockImplementation(async () => {
        order.push("impact");
        return affected;
      });
      mockBulkSync.mockImplementation(async () => {
        order.push("sync");
        return {
          workshopsSynced: 0,
          membershipPlansSynced: 1,
          equipmentSynced: 0,
          errors: [],
        };
      });
      mockClearOrphanedScopedDiscounts.mockImplementation(async () => {
        order.push("clear");
        return 1;
      });

      await post({ actionType: "clearAndResync" });

      expect(order).toEqual(["impact", "sync", "clear"]);
    });

    it("ends the orphaned discounts and reports how many", async () => {
      asAdmin();
      mockListProductScopedDiscounts.mockResolvedValue(affected);
      mockClearOrphanedScopedDiscounts.mockResolvedValue(1);

      const body = await (await post({ actionType: "clearAndResync" })).json();

      expect(mockClearOrphanedScopedDiscounts).toHaveBeenCalledWith(affected);
      expect(body.discountsEnded).toBe(1);
    });

    // The worklist is only actionable if it names the product to scope the replacement to.
    it("returns each plan's new product id alongside the member", async () => {
      asAdmin();
      mockListProductScopedDiscounts.mockResolvedValue(affected);
      mockDb.membershipPlan.findMany.mockResolvedValue([
        { id: 3, stripeProductId: "prod_new" },
      ]);

      const body = await (await post({ actionType: "clearAndResync" })).json();

      expect(body.affected[0]).toMatchObject({
        email: "ada@example.com",
        planProductId: "prod_old",
        newProductId: "prod_new",
      });
    });

    it("still re-syncs when no discount is at risk", async () => {
      asAdmin();

      const body = await (await post({ actionType: "clearAndResync" })).json();

      expect(mockBulkSync).toHaveBeenCalledWith(true);
      expect(body.success).toBe(true);
      expect(body.affected).toEqual([]);
      expect(body.discountsEnded).toBe(0);
    });
  });

  it("rejects an unknown actionType", async () => {
    asAdmin();

    const response = await post({ actionType: "nonsense" });

    expect(response.status).toBe(400);
  });
});
