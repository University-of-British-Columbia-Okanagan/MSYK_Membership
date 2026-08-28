// session.server throws at import time if SESSION_SECRET is unset, and the route pulls
// it in transitively — so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import { getRoleUser } from "~/utils/session.server";
import { getAdminSetting } from "~/models/admin.server";
import { getOrCreateGstTaxRate } from "~/services/stripe-discounts.server";
import { endRecurringDiscountForUser } from "~/models/membership.server";
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
    mockBulkSync.mockResolvedValue({
      workshopsSynced: 0,
      membershipPlansSynced: 0,
      equipmentSynced: 0,
      errors: [],
    });
    mockDb.userMembership = { findMany: jest.fn().mockResolvedValue([]) };
    mockDb.workshop = { count: jest.fn().mockResolvedValue(0) };
    mockDb.membershipPlan = { count: jest.fn().mockResolvedValue(0) };
    mockDb.equipment = { count: jest.fn().mockResolvedValue(0) };
  });

  describe("authorisation", () => {
    it.each(["getDiscountStatus", "endDiscount", "bulkSync", "clearAndResync"])(
      "rejects %s for a non-admin",
      async (actionType) => {
        mockGetRoleUser.mockResolvedValue({ userId: 2, roleName: "User" });

        const response = await post({ actionType, userId: "5" });

        expect(response.status).toBe(403);
        expect(mockEndRecurringDiscount).not.toHaveBeenCalled();
        expect(mockBulkSync).not.toHaveBeenCalled();
      }
    );

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

  it("rejects an unknown actionType", async () => {
    asAdmin();

    const response = await post({ actionType: "nonsense" });

    expect(response.status).toBe(400);
  });
});
