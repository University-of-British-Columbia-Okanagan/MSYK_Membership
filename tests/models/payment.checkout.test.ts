import "tests/fixtures/payment/setup";

import {
  getPaymentMocks,
  resetPaymentMocks,
  mockGetOrCreateGstTaxRate,
} from "tests/fixtures/payment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  checkMultiDayWorkshopCapacity,
  checkWorkshopCapacity,
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  getWorkshopPriceVariation,
  registerForWorkshop,
  registerUserForAllOccurrences,
} from "~/models/workshop.server";
import {
  calculateProratedUpgradeAmount,
  getMembershipPlanById,
  getOwnedMembership,
} from "~/models/membership.server";
import { MembershipChangeError } from "~/utils/membership-rules";
import { createCheckoutSession } from "~/models/payment.server";

const SESSION_USER = 4;
const DAY = 24 * 60 * 60 * 1000;

const WORKSHOP = {
  id: 1,
  name: "Laser Cutting Basics",
  price: 30,
  location: "Makerspace YK",
  type: "workshop",
  registrationCutoff: 60,
  stripeProductId: null,
};

const occurrence = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  workshopId: 1,
  connectId: 3,
  status: "active",
  startDate: new Date(Date.now() + 3 * DAY),
  endDate: new Date(Date.now() + 3 * DAY + 2 * 60 * 60 * 1000),
  ...overrides,
});

const PLAN = {
  id: 2,
  title: "Makerspace Member",
  description: "Access",
  price: 50,
  price3Months: 140,
  price6Months: null,
  priceYearly: 500,
  needAdminPermission: false,
  stripeProductId: "prod_2",
};

function post(body: Record<string, unknown>) {
  return createCheckoutSession(
    new Request("http://localhost/dashboard/paymentprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    SESSION_USER
  );
}

const asJson = async (result: unknown): Promise<any> => (result instanceof Response ? result.json() : result);

describe("createCheckoutSession - the session user pays the server's price", () => {
  const m = getPaymentMocks();
  const lastSession = () => m.stripeCheckoutSessionsCreateMock.mock.calls.at(-1)![0];

  beforeEach(() => {
    clearAllMocks();
    resetPaymentMocks();
    m.db.user.findUnique.mockResolvedValue({
      id: SESSION_USER,
      email: "member@example.com",
      membershipStatus: "active",
      roleLevel: 3,
      allowLevel4: false,
    });
    m.stripeCheckoutSessionsCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
    m.stripePaymentIntentsCreateMock.mockResolvedValue({ id: "pi_1", status: "succeeded" });
    m.mockGetSavedPaymentMethod.mockResolvedValue({ stripeCustomerId: "cus_4", stripePaymentMethodId: "pm_4" });
    m.db.paymentFulfillment.create.mockResolvedValue({});
    mockGetOrCreateGstTaxRate.mockResolvedValue("txr_5");
    (getWorkshopById as jest.Mock).mockResolvedValue(WORKSHOP);
    (getWorkshopOccurrence as jest.Mock).mockResolvedValue(occurrence());
    (getWorkshopOccurrencesByConnectId as jest.Mock).mockResolvedValue([
      occurrence(),
      occurrence({ id: 11, startDate: new Date(Date.now() + 4 * DAY), endDate: new Date(Date.now() + 4 * DAY + 1) }),
    ]);
    (getWorkshopPriceVariation as jest.Mock).mockResolvedValue(null);
    (checkWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: true });
    (checkMultiDayWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: true });
    (getMembershipPlanById as jest.Mock).mockResolvedValue(PLAN);
  });

  describe("D1: identity comes from the session, never the body", () => {
    it("quick checkout charges the session user's saved card, not body.userId's", async () => {
      await post({ useSavedCard: true, userId: 99, workshopId: 1, occurrenceId: 10 });

      expect(m.mockGetSavedPaymentMethod).toHaveBeenCalledWith(SESSION_USER);
      expect(m.mockGetSavedPaymentMethod).not.toHaveBeenCalledWith(99);
      expect(registerForWorkshop).toHaveBeenCalledWith(1, 10, SESSION_USER, null, "pi_1");
    });

    it("Stripe Checkout carries the session user in its metadata", async () => {
      await post({ userId: 99, workshopId: 1, occurrenceId: 10 });

      expect(lastSession().metadata.userId).toBe(String(SESSION_USER));
    });
  });

  describe("D2: workshop prices", () => {
    it("charges the workshop's price plus GST, ignoring a price in the body", async () => {
      await post({ workshopId: 1, occurrenceId: 10, price: 0.01 });

      expect(lastSession().line_items[0].price_data.unit_amount).toBe(3150);
    });

    it("does not register for free when the browser says 0 but the server price is not", async () => {
      await post({ workshopId: 1, occurrenceId: 10, price: 0 });

      expect(registerForWorkshop).not.toHaveBeenCalled();
      expect(m.stripeCheckoutSessionsCreateMock).toHaveBeenCalled();
    });

    it("charges the price variation's price when it belongs to the workshop", async () => {
      (getWorkshopPriceVariation as jest.Mock).mockResolvedValue({ id: 5, workshopId: 1, name: "Student", price: 20 });

      await post({ workshopId: 1, occurrenceId: 10, variationId: 5 });

      expect(lastSession().line_items[0].price_data.unit_amount).toBe(2100);
      expect(lastSession().metadata.variationId).toBe("5");
    });

    it("refuses a price variation from another workshop", async () => {
      (getWorkshopPriceVariation as jest.Mock).mockResolvedValue({ id: 5, workshopId: 2, name: "Free", price: 0 });

      const res = (await post({ workshopId: 1, occurrenceId: 10, variationId: 5 })) as Response;

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "That price option does not belong to this workshop." });
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
      expect(registerForWorkshop).not.toHaveBeenCalled();
    });

    it("registers the session user without Stripe only when the server price is 0", async () => {
      (getWorkshopById as jest.Mock).mockResolvedValue({ ...WORKSHOP, price: 0 });

      const body = await asJson(await post({ workshopId: 1, occurrenceId: 10, price: 30 }));

      expect(registerForWorkshop).toHaveBeenCalledWith(1, 10, SESSION_USER, null, undefined);
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
      expect(body.url).toBe("/dashboard/payment/success?quick_checkout=true&type=workshop&free=1");
    });

    it("prices a multi-day workshop on the server too", async () => {
      await post({ workshopId: 1, connectId: 3, price: 1 });

      expect(lastSession().line_items[0].price_data.unit_amount).toBe(3150);
      expect(lastSession().metadata).toMatchObject({ workshopId: "1", connectId: "3", userId: "4" });
    });

    it("registers every session of a free multi-day workshop", async () => {
      (getWorkshopById as jest.Mock).mockResolvedValue({ ...WORKSHOP, price: 0 });

      await post({ workshopId: 1, connectId: 3 });

      expect(registerUserForAllOccurrences).toHaveBeenCalledWith(1, 3, SESSION_USER, null, undefined);
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });

    it("refuses a full workshop before taking payment", async () => {
      (checkWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: false });

      const res = (await post({ workshopId: 1, occurrenceId: 10 })) as Response;

      expect(res.status).toBe(400);
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });

    it("refuses a cancelled session", async () => {
      (getWorkshopOccurrence as jest.Mock).mockResolvedValue(occurrence({ status: "cancelled" }));

      const res = (await post({ workshopId: 1, occurrenceId: 10 })) as Response;

      expect(res.status).toBe(400);
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("D2/D6: membership prices and rules", () => {
    it("charges the chosen billing cycle's price, ignoring a price in the body", async () => {
      await post({ membershipPlanId: 2, billingCycle: "yearly", price: 1 });

      const line = lastSession().line_items[0];
      expect(line.price_data.unit_amount).toBe(50000);
      expect(line.tax_rates).toEqual(["txr_5"]);
      expect(lastSession().metadata).toMatchObject({ billingCycle: "yearly", userId: "4" });
    });

    it("refuses a billing cycle the plan has no price for instead of charging the monthly price", async () => {
      const res = (await post({ membershipPlanId: 2, billingCycle: "semiannually" })) as Response;

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: "This plan is not offered with semiannual billing. Please choose another billing cycle.",
      });
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });

    it("refuses an upgrade from a membership the member does not own", async () => {
      (getOwnedMembership as jest.Mock).mockRejectedValue(
        new MembershipChangeError("That membership could not be found on your account.")
      );

      const res = (await post({ membershipPlanId: 2, currentMembershipId: 77 })) as Response;

      expect(getOwnedMembership).toHaveBeenCalledWith(SESSION_USER, 77, "active");
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("That membership could not be found on your account.");
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });

    it("charges the server's prorated fee for an upgrade from the member's own monthly plan", async () => {
      (getOwnedMembership as jest.Mock).mockResolvedValue({
        id: 7,
        userId: SESSION_USER,
        billingCycle: "monthly",
        nextPaymentDate: new Date(Date.now() + 15 * DAY),
        membershipPlan: { price: 30 },
      });
      (calculateProratedUpgradeAmount as jest.Mock).mockReturnValue(9.5);

      await post({ membershipPlanId: 2, currentMembershipId: 7, price: 1, upgradeFee: 0.01 });

      expect(lastSession().line_items[0].price_data.unit_amount).toBe(950);
      expect(lastSession().metadata.currentMembershipId).toBe("7");
    });

    it("refuses a plan that needs admin permission the member does not have", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ ...PLAN, needAdminPermission: true });

      const res = (await post({ membershipPlanId: 2 })) as Response;

      expect(res.status).toBe(403);
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("D4: equipment is priced from the server-held checkout", () => {
    beforeEach(() => {
      m.db.equipment.findUnique.mockResolvedValue({ id: 1, name: "Laser Cutter", stripeProductId: null });
    });

    it("charges the held amount and points the session at the checkout", async () => {
      m.db.equipmentCheckout.findUnique.mockResolvedValue({
        id: "chk_1",
        userId: SESSION_USER,
        equipmentId: 1,
        slots: [{}, {}],
        amount: 40,
        fulfilledAt: null,
      });

      await post({ equipmentCheckoutId: "chk_1", price: 0.01, slotCount: 99 });

      expect(lastSession().line_items[0].price_data.unit_amount).toBe(4200);
      expect(lastSession().metadata).toMatchObject({
        equipmentCheckoutId: "chk_1",
        equipmentId: "1",
        userId: "4",
        isEquipmentBooking: "true",
      });
    });

    it.each([
      ["another member's", { userId: 9, fulfilledAt: null }],
      ["an already booked", { userId: SESSION_USER, fulfilledAt: new Date() }],
    ])("refuses %s checkout", async (_label, overrides) => {
      m.db.equipmentCheckout.findUnique.mockResolvedValue({
        id: "chk_1",
        equipmentId: 1,
        slots: [{}],
        amount: 20,
        ...overrides,
      });

      const res = (await post({ equipmentCheckoutId: "chk_1" })) as Response;

      expect(res.status).toBe(404);
      expect(m.stripeCheckoutSessionsCreateMock).not.toHaveBeenCalled();
    });
  });

  it("answers a request it cannot place with a 400, not a crash", async () => {
    const res = (await post({ hello: "world" })) as Response;

    expect(res.status).toBe(400);
  });
});
