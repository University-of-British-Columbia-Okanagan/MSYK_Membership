const createDiscountsDbMock = () => ({
  db: {
    userMembership: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
});

type DiscountsDbMock = ReturnType<typeof createDiscountsDbMock>["db"];

jest.mock("~/utils/db.server", () => createDiscountsDbMock());

const getAdminSettingMock = jest.fn();
const updateAdminSettingMock = jest.fn();

jest.mock("~/models/admin.server", () => ({
  getAdminSetting: getAdminSettingMock,
  updateAdminSetting: updateAdminSettingMock,
}));

const customersUpdateMock = jest.fn();
const customersRetrieveMock = jest.fn();
const customersDeleteDiscountMock = jest.fn();
const taxRatesCreateMock = jest.fn();
const taxRatesListMock = jest.fn();
const taxRatesRetrieveMock = jest.fn();
const invoicesCreateMock = jest.fn();
const invoicesFinalizeMock = jest.fn();
const invoicesPayMock = jest.fn();
const invoiceItemsCreateMock = jest.fn();
const sessionsRetrieveMock = jest.fn();
const promotionCodesRetrieveMock = jest.fn();

const stripeConstructorMock = jest.fn().mockImplementation(() => ({
  customers: {
    update: customersUpdateMock,
    retrieve: customersRetrieveMock,
    deleteDiscount: customersDeleteDiscountMock,
  },
  taxRates: {
    create: taxRatesCreateMock,
    list: taxRatesListMock,
    retrieve: taxRatesRetrieveMock,
  },
  invoices: {
    create: invoicesCreateMock,
    finalizeInvoice: invoicesFinalizeMock,
    pay: invoicesPayMock,
  },
  invoiceItems: { create: invoiceItemsCreateMock },
  checkout: { sessions: { retrieve: sessionsRetrieveMock } },
  promotionCodes: { retrieve: promotionCodesRetrieveMock },
}));

jest.mock("stripe", () => ({
  __esModule: true,
  default: stripeConstructorMock,
  Stripe: stripeConstructorMock,
}));

import { clearAllMocks } from "tests/helpers/test-utils";
import {
  getOrCreateGstTaxRate,
  getCheckoutSessionCouponId,
  applyMembershipDiscount,
  clearMembershipDiscount,
  getCustomerDiscount,
  previewMembershipCharge,
  chargeMembershipViaInvoice,
  GST_TAX_RATE_SETTING_KEY,
} from "~/services/stripe-discounts.server";

const { db } = require("~/utils/db.server") as { db: DiscountsDbMock };

/** A paid invoice as Stripe returns it: 50.00 base, 50% off, 5% GST on the remainder. */
const discountedInvoice = {
  id: "in_1",
  status: "paid",
  subtotal: 5000,
  total: 2625,
  payment_intent: "pi_1",
  total_discount_amounts: [{ amount: 2500, discount: "di_1" }],
  total_tax_amounts: [{ amount: 125, tax_rate: "txr_1" }],
};

describe("stripe-discounts.server", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    clearAllMocks();
    getAdminSettingMock.mockReset().mockResolvedValue("");
    updateAdminSettingMock.mockReset().mockResolvedValue(undefined);
    customersUpdateMock.mockReset();
    customersRetrieveMock.mockReset();
    customersDeleteDiscountMock.mockReset().mockResolvedValue({});
    taxRatesCreateMock.mockReset();
    taxRatesListMock.mockReset().mockResolvedValue({ data: [] });
    taxRatesRetrieveMock.mockReset();
    invoicesCreateMock.mockReset();
    invoicesFinalizeMock.mockReset();
    invoicesPayMock.mockReset();
    invoiceItemsCreateMock.mockReset().mockResolvedValue({ id: "ii_1" });
    sessionsRetrieveMock.mockReset();
    promotionCodesRetrieveMock.mockReset();
    db.userMembership.update.mockReset().mockResolvedValue({});
    db.userMembership.updateMany.mockReset().mockResolvedValue({ count: 0 });
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  describe("getOrCreateGstTaxRate", () => {
    it("reuses the stored rate when it is still active at the same percentage", async () => {
      getAdminSettingMock.mockResolvedValue("txr_stored");
      taxRatesRetrieveMock.mockResolvedValue({
        id: "txr_stored",
        active: true,
        percentage: 5,
      });

      await expect(getOrCreateGstTaxRate(5)).resolves.toBe("txr_stored");
      expect(taxRatesCreateMock).not.toHaveBeenCalled();
    });

    it("creates a new rate when GST changes, because Stripe rates are immutable", async () => {
      getAdminSettingMock.mockResolvedValue("txr_stored");
      taxRatesRetrieveMock.mockResolvedValue({
        id: "txr_stored",
        active: true,
        percentage: 5,
      });
      taxRatesCreateMock.mockResolvedValue({ id: "txr_new" });

      await expect(getOrCreateGstTaxRate(7)).resolves.toBe("txr_new");
      expect(taxRatesCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ percentage: 7, inclusive: false })
      );
      expect(updateAdminSettingMock).toHaveBeenCalledWith(
        GST_TAX_RATE_SETTING_KEY,
        "txr_new"
      );
    });

    it("adopts a previously tagged rate rather than creating a duplicate", async () => {
      taxRatesListMock.mockResolvedValue({
        data: [
          {
            id: "txr_tagged",
            percentage: 5,
            inclusive: false,
            metadata: { portal: "msyk", kind: "gst" },
          },
        ],
      });

      await expect(getOrCreateGstTaxRate(5)).resolves.toBe("txr_tagged");
      expect(taxRatesCreateMock).not.toHaveBeenCalled();
    });

    it("returns null rather than throwing when Stripe is unreachable", async () => {
      taxRatesListMock.mockRejectedValue(new Error("stripe down"));
      await expect(getOrCreateGstTaxRate(5)).resolves.toBeNull();
    });
  });

  describe("getCheckoutSessionCouponId", () => {
    it("expands only to .discount — Stripe rejects a 5th level", async () => {
      sessionsRetrieveMock.mockResolvedValue({ discounts: [] });

      await getCheckoutSessionCouponId("cs_1");

      expect(sessionsRetrieveMock).toHaveBeenCalledWith("cs_1", {
        expand: ["total_details.breakdown.discounts.discount"],
      });
    });

    it("reads the coupon inlined on the expanded discount", async () => {
      sessionsRetrieveMock.mockResolvedValue({
        total_details: {
          breakdown: {
            discounts: [
              {
                amount: 2500,
                discount: { id: "di_1", coupon: { id: "co_1", percent_off: 50 } },
              },
            ],
          },
        },
        discounts: [{ coupon: null, promotion_code: "promo_1" }],
      });

      await expect(getCheckoutSessionCouponId("cs_1")).resolves.toBe("co_1");
      expect(promotionCodesRetrieveMock).not.toHaveBeenCalled();
    });

    it("resolves a typed promotion code, which arrives with coupon null", async () => {
      sessionsRetrieveMock.mockResolvedValue({
        total_details: { breakdown: { discounts: [] } },
        discounts: [{ coupon: null, promotion_code: "promo_1" }],
      });
      promotionCodesRetrieveMock.mockResolvedValue({
        code: "HALFSIX",
        coupon: { id: "co_1" },
      });

      await expect(getCheckoutSessionCouponId("cs_1")).resolves.toBe("co_1");
      expect(promotionCodesRetrieveMock).toHaveBeenCalledWith("promo_1");
    });

    it("accepts a promotion code whose coupon comes back as a bare id", async () => {
      sessionsRetrieveMock.mockResolvedValue({
        discounts: [{ coupon: null, promotion_code: { id: "promo_2" } }],
      });
      promotionCodesRetrieveMock.mockResolvedValue({ coupon: "co_2" });

      await expect(getCheckoutSessionCouponId("cs_1")).resolves.toBe("co_2");
    });

    it("returns null when no code was used", async () => {
      sessionsRetrieveMock.mockResolvedValue({
        total_details: { breakdown: { discounts: [] } },
        discounts: [],
      });

      await expect(getCheckoutSessionCouponId("cs_1")).resolves.toBeNull();
    });

    it("returns null rather than throwing when the retrieve fails", async () => {
      sessionsRetrieveMock.mockRejectedValue(new Error("bad expand"));

      await expect(getCheckoutSessionCouponId("cs_1")).resolves.toBeNull();
    });
  });

  describe("applyMembershipDiscount", () => {
    it("pins the coupon to the customer and mirrors the expiry locally", async () => {
      const end = 1800000000;
      customersUpdateMock.mockResolvedValue({
        id: "cus_1",
        discount: { coupon: { id: "co_1" }, end },
      });

      const result = await applyMembershipDiscount("cus_1", "co_1", 42);

      expect(customersUpdateMock).toHaveBeenCalledWith("cus_1", {
        coupon: "co_1",
      });
      expect(result).toEqual({ couponId: "co_1", endsAt: new Date(end * 1000) });
      expect(db.userMembership.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { stripeCouponId: "co_1", discountEndsAt: new Date(end * 1000) },
      });
    });

    it("records a forever coupon with no expiry", async () => {
      customersUpdateMock.mockResolvedValue({
        id: "cus_1",
        discount: { coupon: { id: "co_forever" }, end: null },
      });

      const result = await applyMembershipDiscount("cus_1", "co_forever", 7);

      expect(result).toEqual({ couponId: "co_forever", endsAt: null });
      expect(db.userMembership.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { stripeCouponId: "co_forever", discountEndsAt: null },
      });
    });

    it("returns null and logs when Stripe rejects the coupon", async () => {
      customersUpdateMock.mockRejectedValue(new Error("no such coupon"));

      await expect(
        applyMembershipDiscount("cus_1", "co_bad", 1)
      ).resolves.toBeNull();
      expect(db.userMembership.update).not.toHaveBeenCalled();
    });
  });

  describe("clearMembershipDiscount", () => {
    it("deletes an active discount and clears the mirrored fields", async () => {
      customersRetrieveMock.mockResolvedValue({
        deleted: false,
        discount: { coupon: { id: "co_1" } },
      });

      await expect(clearMembershipDiscount("cus_1", [3, 4])).resolves.toBe(true);

      expect(customersDeleteDiscountMock).toHaveBeenCalledWith("cus_1");
      expect(db.userMembership.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [3, 4] } },
        data: { stripeCouponId: null, discountEndsAt: null },
      });
    });

    it("does not call deleteDiscount when there is none, because Stripe throws", async () => {
      customersRetrieveMock.mockResolvedValue({ deleted: false, discount: null });

      await expect(clearMembershipDiscount("cus_1", [3])).resolves.toBe(false);

      expect(customersDeleteDiscountMock).not.toHaveBeenCalled();
      expect(db.userMembership.updateMany).toHaveBeenCalled();
    });

    it("still clears local fields when the member has no Stripe customer", async () => {
      await expect(clearMembershipDiscount(null, [9])).resolves.toBe(false);

      expect(customersRetrieveMock).not.toHaveBeenCalled();
      expect(db.userMembership.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [9] } },
        data: { stripeCouponId: null, discountEndsAt: null },
      });
    });
  });

  describe("getCustomerDiscount", () => {
    it("reports percent, amount and expiry", async () => {
      const end = 1800000000;
      customersRetrieveMock.mockResolvedValue({
        deleted: false,
        discount: {
          coupon: { id: "co_1", percent_off: 50, amount_off: null },
          end,
        },
      });

      await expect(getCustomerDiscount("cus_1")).resolves.toEqual({
        couponId: "co_1",
        percentOff: 50,
        amountOff: null,
        endsAt: new Date(end * 1000),
      });
    });

    it("returns null for a deleted customer", async () => {
      customersRetrieveMock.mockResolvedValue({ deleted: true });
      await expect(getCustomerDiscount("cus_1")).resolves.toBeNull();
    });
  });

  describe("previewMembershipCharge", () => {
    it("taxes the discounted base, not the list price", async () => {
      customersRetrieveMock.mockResolvedValue({
        deleted: false,
        discount: { coupon: { id: "co_1", percent_off: 50 }, end: null },
      });

      await expect(
        previewMembershipCharge({
          customerId: "cus_1",
          baseAmount: 50,
          gstPercentage: 5,
        })
      ).resolves.toEqual({
        baseAmount: 50,
        discountAmount: 25,
        taxAmount: 1.25,
        total: 26.25,
      });
    });

    it("applies a fixed amount_off coupon in cents", async () => {
      customersRetrieveMock.mockResolvedValue({
        deleted: false,
        discount: {
          coupon: { id: "co_1", percent_off: null, amount_off: 1000 },
          end: null,
        },
      });

      await expect(
        previewMembershipCharge({
          customerId: "cus_1",
          baseAmount: 50,
          gstPercentage: 5,
        })
      ).resolves.toEqual({
        baseAmount: 50,
        discountAmount: 10,
        taxAmount: 2,
        total: 42,
      });
    });

    it("never discounts below zero", async () => {
      customersRetrieveMock.mockResolvedValue({
        deleted: false,
        discount: {
          coupon: { id: "co_1", percent_off: null, amount_off: 99999 },
          end: null,
        },
      });

      await expect(
        previewMembershipCharge({
          customerId: "cus_1",
          baseAmount: 50,
          gstPercentage: 5,
        })
      ).resolves.toEqual({
        baseAmount: 50,
        discountAmount: 50,
        taxAmount: 0,
        total: 0,
      });
    });

    it("ignores a discount that expires before the charge date", async () => {
      customersRetrieveMock.mockResolvedValue({
        deleted: false,
        discount: {
          coupon: { id: "co_1", percent_off: 50 },
          end: Math.floor(new Date("2026-01-01").getTime() / 1000),
        },
      });

      await expect(
        previewMembershipCharge({
          customerId: "cus_1",
          baseAmount: 50,
          gstPercentage: 5,
          chargeOn: new Date("2026-06-01"),
        })
      ).resolves.toEqual({
        baseAmount: 50,
        discountAmount: 0,
        taxAmount: 2.5,
        total: 52.5,
      });
    });

    it("charges full price when the member has no Stripe customer", async () => {
      await expect(
        previewMembershipCharge({
          customerId: null,
          baseAmount: 50,
          gstPercentage: 5,
        })
      ).resolves.toEqual({
        baseAmount: 50,
        discountAmount: 0,
        taxAmount: 2.5,
        total: 52.5,
      });
    });
  });

  describe("chargeMembershipViaInvoice", () => {
    const params = {
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      baseAmount: 50,
      description: "Makerspace Member - monthly",
      gstPercentage: 5,
      metadata: { membershipId: "1" },
    };

    beforeEach(() => {
      getAdminSettingMock.mockResolvedValue("txr_1");
      taxRatesRetrieveMock.mockResolvedValue({
        id: "txr_1",
        active: true,
        percentage: 5,
      });
      invoicesCreateMock.mockResolvedValue({ id: "in_1" });
    });

    it("binds the line to the invoice and returns the discounted totals", async () => {
      invoicesFinalizeMock.mockResolvedValue({
        ...discountedInvoice,
        status: "open",
      });
      invoicesPayMock.mockResolvedValue(discountedInvoice);

      const result = await chargeMembershipViaInvoice(params);

      // The base goes over untaxed; GST is the tax rate's job so it lands after the discount.
      expect(invoiceItemsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_1",
          invoice: "in_1",
          amount: 5000,
          currency: "cad",
          tax_rates: ["txr_1"],
        })
      );
      expect(result).toEqual({
        invoiceId: "in_1",
        paymentIntentId: "pi_1",
        status: "paid",
        subtotal: 50,
        discountAmount: 25,
        taxAmount: 1.25,
        total: 26.25,
      });
    });

    // A coupon created with "Apply to specific products" is ignored on an invoice line
    // that carries no product — which would leave exactly those coupons discounting the
    // first payment and nothing afterwards, i.e. the original bug.
    it("puts the plan's Stripe Product on the line so restricted coupons still apply", async () => {
      invoicesFinalizeMock.mockResolvedValue(discountedInvoice);

      await chargeMembershipViaInvoice({ ...params, stripeProductId: "prod_1" });

      expect(invoiceItemsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice: "in_1",
          price_data: {
            currency: "cad",
            product: "prod_1",
            unit_amount: 5000,
          },
          tax_rates: ["txr_1"],
        })
      );
      expect(invoiceItemsCreateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ amount: expect.anything() })
      );
    });

    it("falls back to a bare amount when the plan has no synced Product", async () => {
      invoicesFinalizeMock.mockResolvedValue(discountedInvoice);

      await chargeMembershipViaInvoice({ ...params, stripeProductId: null });

      expect(invoiceItemsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5000, currency: "cad" })
      );
      expect(invoiceItemsCreateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ price_data: expect.anything() })
      );
    });

    it("does not pay an invoice a full discount already settled", async () => {
      invoicesFinalizeMock.mockResolvedValue({
        id: "in_2",
        status: "paid",
        subtotal: 5000,
        total: 0,
        payment_intent: null,
        total_discount_amounts: [{ amount: 5000 }],
        total_tax_amounts: [],
      });

      const result = await chargeMembershipViaInvoice(params);

      expect(invoicesPayMock).not.toHaveBeenCalled();
      expect(result.total).toBe(0);
      expect(result.paymentIntentId).toBeNull();
    });

    it("omits tax_rates when the GST rate could not be resolved", async () => {
      taxRatesRetrieveMock.mockRejectedValue(new Error("gone"));
      taxRatesListMock.mockRejectedValue(new Error("stripe down"));
      invoicesFinalizeMock.mockResolvedValue(discountedInvoice);

      await chargeMembershipViaInvoice(params);

      expect(invoiceItemsCreateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ tax_rates: expect.anything() })
      );
    });
  });
});
