import "tests/fixtures/payment/setup";

import {
  getPaymentMocks,
  mockGetOrCreateGstTaxRate,
  resetPaymentMocks,
} from "tests/fixtures/payment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import { getMembershipPlanById } from "~/models/membership.server";
import { createCheckoutSession } from "~/models/payment.server";

const mockGetMembershipPlanById = getMembershipPlanById as jest.Mock;

const postMembership = (body: Record<string, unknown>) =>
  createCheckoutSession(
    new Request("http://localhost/dashboard/paymentprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    4
  ) as Promise<Response>;

/**
 * GST rides as a Stripe tax rate rather than being folded into unit_amount. That is what
 * lets a promotion code discount the base and have GST charged on the reduced amount,
 * matching how renewals are invoiced. Folding it in would tax the full price at signup.
 *
 * These ran against payment.tsx's action until that unused action was removed; the live
 * membership checkout is createCheckoutSession, reached through /dashboard/paymentprocess.
 */
describe("createCheckoutSession - membership checkout GST", () => {
  const m = getPaymentMocks();
  const lastSession = () => m.stripeCheckoutSessionsCreateMock.mock.calls.at(-1)![0];

  beforeEach(() => {
    clearAllMocks();
    resetPaymentMocks();
    m.db.user.findUnique.mockResolvedValue({ id: 4, membershipStatus: "active", roleLevel: 3, allowLevel4: false });
    mockGetMembershipPlanById.mockResolvedValue({
      id: 1,
      title: "Makerspace Member",
      description: "Access",
      price: 50,
      needAdminPermission: false,
      stripeProductId: "prod_1",
    });
    m.mockGetAdminSetting.mockResolvedValue("5");
    mockGetOrCreateGstTaxRate.mockResolvedValue("txr_1");
    m.stripeCheckoutSessionsCreateMock.mockResolvedValue({ url: "https://checkout.test/session" });
  });

  it("sends the base price with GST as a tax rate, not baked into unit_amount", async () => {
    await postMembership({ membershipPlanId: 1 });

    const lineItem = lastSession().line_items[0];
    // $50.00, not $52.50: GST is the tax rate's job.
    expect(lineItem.price_data.unit_amount).toBe(5000);
    expect(lineItem.tax_rates).toEqual(["txr_1"]);
    expect(mockGetOrCreateGstTaxRate).toHaveBeenCalledWith(5);
  });

  it("lets the member enter a promotion code", async () => {
    await postMembership({ membershipPlanId: 1 });

    expect(lastSession().allow_promotion_codes).toBe(true);
  });

  it("uses the plan's Stripe Product so restricted coupons apply", async () => {
    await postMembership({ membershipPlanId: 1 });

    expect(lastSession().line_items[0].price_data.product).toBe("prod_1");
  });

  it("falls back to inline product data when the plan is not synced", async () => {
    mockGetMembershipPlanById.mockResolvedValue({
      id: 1,
      title: "Makerspace Member",
      description: "Access",
      price: 50,
      needAdminPermission: false,
      stripeProductId: null,
    });

    await postMembership({ membershipPlanId: 1 });

    const priceData = lastSession().line_items[0].price_data;
    expect(priceData.product).toBeUndefined();
    expect(priceData.product_data.name).toBe("Makerspace Member");
    // The description must not claim GST is included when it is added separately.
    expect(priceData.product_data.description).toContain("plus 5% GST");
  });

  it("still creates the session when the GST rate cannot be resolved", async () => {
    mockGetOrCreateGstTaxRate.mockResolvedValue(null);

    await postMembership({ membershipPlanId: 1 });

    const lineItem = lastSession().line_items[0];
    expect(lineItem.tax_rates).toBeUndefined();
    expect(lineItem.price_data.unit_amount).toBe(5000);
  });

  it("honours a non-default GST percentage", async () => {
    m.mockGetAdminSetting.mockResolvedValue("12");
    mockGetOrCreateGstTaxRate.mockResolvedValue("txr_12");

    await postMembership({ membershipPlanId: 1 });

    expect(mockGetOrCreateGstTaxRate).toHaveBeenCalledWith(12);
    expect(lastSession().line_items[0].tax_rates).toEqual(["txr_12"]);
    expect(lastSession().line_items[0].price_data.unit_amount).toBe(5000);
  });

  it("refuses checkout for a revoked member", async () => {
    m.db.user.findUnique.mockResolvedValue({ id: 4, membershipStatus: "revoked", roleLevel: 3 });

    const response = await postMembership({ membershipPlanId: 1 });

    expect(response.status).toBe(403);
    expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
  });
});
