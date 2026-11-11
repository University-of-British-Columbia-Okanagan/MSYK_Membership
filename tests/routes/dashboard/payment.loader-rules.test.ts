// session.server throws at import time if SESSION_SECRET is unset, and payment.tsx
// pulls it in transitively, so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import { getUser, getRoleUser } from "~/utils/session.server";
import { getSavedPaymentMethod, getUserById } from "~/models/user.server";
import {
  checkWorkshopCapacity,
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopPriceVariation,
} from "~/models/workshop.server";
import { getMembershipPlanById, getUserActiveMembership } from "~/models/membership.server";
import { getAdminSetting } from "~/models/admin.server";
import * as paymentRoute from "~/routes/dashboard/payment";

jest.mock("~/utils/session.server");
jest.mock("~/models/user.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/membership.server");
jest.mock("~/models/admin.server");
jest.mock("~/logging/logger");

const DAY = 24 * 60 * 60 * 1000;

async function run(params: Record<string, string>, query = "") {
  try {
    return await paymentRoute.loader({
      request: new Request(`http://localhost/dashboard/payment${query}`),
      params,
      context: {},
    } as any);
  } catch (thrown) {
    return thrown;
  }
}

describe("payment route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: 1, email: "m@example.com", roleLevel: 3 });
    (getRoleUser as jest.Mock).mockResolvedValue({ userId: 1, roleId: 1, roleName: "User" });
    (getUserById as jest.Mock).mockResolvedValue({ id: 1, roleLevel: 3, allowLevel4: false, membershipStatus: "active" });
    (getSavedPaymentMethod as jest.Mock).mockResolvedValue(null);
    (getAdminSetting as jest.Mock).mockResolvedValue("5");
    (getUserActiveMembership as jest.Mock).mockResolvedValue(null);
  });

  it("has no action: purchases go through /dashboard/paymentprocess", () => {
    expect((paymentRoute as Record<string, unknown>).action).toBeUndefined();
  });

  it("refuses a price variation that belongs to another workshop", async () => {
    (getWorkshopById as jest.Mock).mockResolvedValue({ id: 1, name: "Laser", price: 30, registrationCutoff: 0 });
    (getWorkshopOccurrence as jest.Mock).mockResolvedValue({
      id: 10,
      status: "active",
      startDate: new Date(Date.now() + DAY),
      endDate: new Date(Date.now() + DAY + 1),
    });
    (getWorkshopPriceVariation as jest.Mock).mockResolvedValue({ id: 5, workshopId: 2, name: "Free", price: 0 });
    (checkWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: true });

    const result = (await run({ workshopId: "1", occurrenceId: "10", variationId: "5" })) as Response;

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(404);
  });

  describe("membership", () => {
    const plan = (overrides: Record<string, unknown> = {}) => ({
      id: 2,
      title: "Member",
      price: 50,
      price3Months: null,
      price6Months: null,
      priceYearly: 500,
      needAdminPermission: false,
      ...overrides,
    });

    it("refuses a billing cycle the plan has no price for instead of showing the monthly price", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue(plan());

      const result = (await run({ membershipPlanId: "2" }, "?billingCycle=quarterly")) as Response;

      expect(result.status).toBe(400);
      expect(await result.text()).toBe(
        "This plan is not offered with quarterly billing. Please choose another billing cycle."
      );
    });

    it("shows the cycle's own price when it exists", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue(plan());

      const result: any = await run({ membershipPlanId: "2" }, "?billingCycle=yearly");

      expect(result.membershipPlan.displayPrice).toBe(500);
    });

    it("does not let ?resubscribe=true skip the admin permission gate", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue(plan({ needAdminPermission: true }));

      const result = (await run({ membershipPlanId: "2" }, "?resubscribe=true")) as Response;

      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/dashboard/user");
    });
  });
});
