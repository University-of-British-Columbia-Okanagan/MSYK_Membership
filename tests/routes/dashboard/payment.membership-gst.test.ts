// session.server throws at import time if SESSION_SECRET is unset, and payment.tsx
// pulls it in transitively — so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import { getUser } from "~/utils/session.server";
import { getUserById } from "~/models/user.server";
import { getMembershipPlanById } from "~/models/membership.server";
import { getAdminSetting } from "~/models/admin.server";
import { getOrCreateGstTaxRate } from "~/services/stripe-discounts.server";
import { action } from "~/routes/dashboard/payment";

// The factory runs during the imports above, so the session mock is created inside it
// and handed back out — a module-scope const would still be in its TDZ.
jest.mock("stripe", () => {
  const create = jest.fn().mockResolvedValue({ url: "https://checkout.test/session" });
  const ctor = jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create } },
  }));
  return { __esModule: true, Stripe: ctor, default: ctor, __create: create };
});

const sessionsCreateMock = (require("stripe") as { __create: jest.Mock }).__create;

jest.mock("~/utils/session.server");
jest.mock("~/models/user.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/membership.server");
jest.mock("~/models/admin.server");
jest.mock("~/services/stripe-discounts.server");
jest.mock("~/logging/logger");

const mockGetUser = getUser as jest.Mock;
const mockGetUserById = getUserById as jest.Mock;
const mockGetMembershipPlanById = getMembershipPlanById as jest.Mock;
const mockGetAdminSetting = getAdminSetting as jest.Mock;
const mockGetGstTaxRate = getOrCreateGstTaxRate as jest.Mock;

const postMembership = (body: Record<string, unknown>) =>
  action({
    request: new Request("http://localhost/dashboard/payment/1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });

const lastSession = () => sessionsCreateMock.mock.calls.at(-1)![0];

/**
 * GST rides as a Stripe tax rate rather than being folded into unit_amount. That is what
 * lets a promotion code discount the base and have GST charged on the reduced amount —
 * matching how renewals are invoiced. Folding it in would tax the full price at signup.
 */
describe("payment action - membership checkout GST", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: 4, email: "member@example.com" });
    mockGetUserById.mockResolvedValue({ id: 4, membershipStatus: "active" });
    mockGetMembershipPlanById.mockResolvedValue({
      id: 1,
      title: "Makerspace Member",
      description: "Access",
      price: 50,
      stripeProductId: "prod_1",
    });
    mockGetAdminSetting.mockResolvedValue("5");
    mockGetGstTaxRate.mockResolvedValue("txr_1");
  });

  it("sends the base price with GST as a tax rate, not baked into unit_amount", async () => {
    await postMembership({ membershipPlanId: 1, price: 50, userId: 4, upgradeFee: 0 });

    const lineItem = lastSession().line_items[0];
    // $50.00, not $52.50 — GST is the tax rate's job.
    expect(lineItem.price_data.unit_amount).toBe(5000);
    expect(lineItem.tax_rates).toEqual(["txr_1"]);
    expect(mockGetGstTaxRate).toHaveBeenCalledWith(5);
  });

  it("lets the member enter a promotion code", async () => {
    await postMembership({ membershipPlanId: 1, price: 50, userId: 4, upgradeFee: 0 });

    expect(lastSession().allow_promotion_codes).toBe(true);
  });

  it("uses the plan's Stripe Product so restricted coupons apply", async () => {
    await postMembership({ membershipPlanId: 1, price: 50, userId: 4, upgradeFee: 0 });

    expect(lastSession().line_items[0].price_data.product).toBe("prod_1");
  });

  it("falls back to inline product data when the plan is not synced", async () => {
    mockGetMembershipPlanById.mockResolvedValue({
      id: 1,
      title: "Makerspace Member",
      description: "Access",
      price: 50,
      stripeProductId: null,
    });

    await postMembership({ membershipPlanId: 1, price: 50, userId: 4, upgradeFee: 0 });

    const priceData = lastSession().line_items[0].price_data;
    expect(priceData.product).toBeUndefined();
    expect(priceData.product_data.name).toBe("Makerspace Member");
    // The description must not claim GST is included when it is added separately.
    expect(priceData.product_data.description).toContain("plus 5% GST");
  });

  it("still creates the session when the GST rate cannot be resolved", async () => {
    mockGetGstTaxRate.mockResolvedValue(null);

    await postMembership({ membershipPlanId: 1, price: 50, userId: 4, upgradeFee: 0 });

    const lineItem = lastSession().line_items[0];
    expect(lineItem.tax_rates).toBeUndefined();
    expect(lineItem.price_data.unit_amount).toBe(5000);
  });

  it("honours a non-default GST percentage", async () => {
    mockGetAdminSetting.mockResolvedValue("12");
    mockGetGstTaxRate.mockResolvedValue("txr_12");

    await postMembership({ membershipPlanId: 1, price: 50, userId: 4, upgradeFee: 0 });

    expect(mockGetGstTaxRate).toHaveBeenCalledWith(12);
    expect(lastSession().line_items[0].tax_rates).toEqual(["txr_12"]);
    expect(lastSession().line_items[0].price_data.unit_amount).toBe(5000);
  });

  it("refuses checkout for a revoked member", async () => {
    mockGetUserById.mockResolvedValue({ id: 4, membershipStatus: "revoked" });

    const response = await postMembership({
      membershipPlanId: 1,
      price: 50,
      userId: 4,
      upgradeFee: 0,
    });

    expect(response.status).toBe(403);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });
});
