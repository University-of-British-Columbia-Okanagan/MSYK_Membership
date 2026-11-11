import "tests/fixtures/payment/setup";

import {
  MockEquipmentBookingError,
  getPaymentMocks,
  resetPaymentMocks,
} from "tests/fixtures/payment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  bookEquipmentBulkByTimes,
  createEquipmentCheckout,
  fulfilEquipmentCheckout,
  prepareEquipmentBooking,
} from "~/models/equipment.server";
import {
  checkWorkshopCapacity,
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopPriceVariation,
  registerForWorkshop,
} from "~/models/workshop.server";
import {
  activateMembershipForm,
  getMembershipPlanById,
  getOwnedMembership,
  registerMembershipSubscription,
} from "~/models/membership.server";
import { MembershipChangeError } from "~/utils/membership-rules";
import {
  claimPaymentFulfillment,
  quickCheckout,
  releasePaymentFulfillment,
} from "~/models/payment.server";

const USER = 6;
const DAY = 24 * 60 * 60 * 1000;
const SLOTS = ["2026-11-17T18:00:00.000Z|2026-11-17T18:30:00.000Z", "2026-11-17T18:30:00.000Z|2026-11-17T19:00:00.000Z"];
const HELD = [
  { startTime: "2026-11-17T18:00:00.000Z", endTime: "2026-11-17T18:30:00.000Z" },
  { startTime: "2026-11-17T18:30:00.000Z", endTime: "2026-11-17T19:00:00.000Z" },
];

describe("quickCheckout - prices, books and records on the server before reporting success", () => {
  const m = getPaymentMocks();
  const charged = () => m.stripePaymentIntentsCreateMock.mock.calls.at(-1)![0];

  beforeEach(() => {
    clearAllMocks();
    resetPaymentMocks();
    m.db.user.findUnique.mockResolvedValue({
      email: "member@example.com",
      membershipStatus: "active",
      roleLevel: 4,
      allowLevel4: true,
    });
    m.mockGetSavedPaymentMethod.mockResolvedValue({ stripeCustomerId: "cus_6", stripePaymentMethodId: "pm_6" });
    m.stripePaymentIntentsCreateMock.mockResolvedValue({ id: "pi_9", status: "succeeded" });
    m.db.paymentFulfillment.create.mockResolvedValue({});
    m.db.paymentFulfillment.deleteMany.mockResolvedValue({ count: 1 });
    (getWorkshopById as jest.Mock).mockResolvedValue({
      id: 1,
      name: "Laser Cutting",
      price: 30,
      location: "Makerspace YK",
      registrationCutoff: 0,
    });
    (getWorkshopOccurrence as jest.Mock).mockResolvedValue({
      id: 10,
      workshopId: 1,
      status: "active",
      startDate: new Date(Date.now() + 3 * DAY),
      endDate: new Date(Date.now() + 3 * DAY + 1),
    });
    (getWorkshopPriceVariation as jest.Mock).mockResolvedValue(null);
    (checkWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: true });
    (getMembershipPlanById as jest.Mock).mockResolvedValue({
      id: 2,
      title: "Member",
      description: "",
      price: 50,
      price3Months: null,
      price6Months: null,
      priceYearly: 500,
      needAdminPermission: false,
      feature: {},
    });
    (registerMembershipSubscription as jest.Mock).mockResolvedValue({ id: 31 });
  });

  describe("equipment", () => {
    beforeEach(() => {
      (prepareEquipmentBooking as jest.Mock).mockResolvedValue({
        equipment: { id: 1, name: "Laser Cutter", price: 30 },
        slots: HELD,
        amount: 60,
      });
      (createEquipmentCheckout as jest.Mock).mockResolvedValue({ id: "chk_1" });
      (fulfilEquipmentCheckout as jest.Mock).mockResolvedValue({ count: 2, alreadyFulfilled: false, equipmentId: 1 });
    });

    it("refuses slots the member may not book and never creates a charge", async () => {
      (prepareEquipmentBooking as jest.Mock).mockRejectedValue(
        new MockEquipmentBookingError("Level 4 members cannot book between 10 PM and 6 AM.")
      );

      const result = await quickCheckout(USER, { type: "equipment", equipmentId: 1, slots: SLOTS });

      expect(prepareEquipmentBooking).toHaveBeenCalledWith(USER, 1, SLOTS);
      expect(result).toEqual({
        success: false,
        error: "Level 4 members cannot book between 10 PM and 6 AM.",
        type: "equipment",
      });
      expect(m.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    });

    it("charges the server's price for the held slots, ignoring any price sent", async () => {
      await quickCheckout(USER, { type: "equipment", equipmentId: 1, slots: SLOTS, price: 0.01 } as any);

      expect(createEquipmentCheckout).toHaveBeenCalledWith(USER, 1, HELD, 60);
      expect(charged().amount).toBe(6300);
      expect(charged().metadata).toMatchObject({ equipmentCheckoutId: "chk_1", userId: "6" });
    });

    it("books the slots and records the payment before reporting success", async () => {
      const order: string[] = [];
      m.db.paymentFulfillment.create.mockImplementation(async () => order.push("record"));
      (fulfilEquipmentCheckout as jest.Mock).mockImplementation(async () => {
        order.push("book");
        return { count: 2, alreadyFulfilled: false, equipmentId: 1 };
      });

      const result = await quickCheckout(USER, { type: "equipment", equipmentId: 1, slots: SLOTS });

      expect(m.db.paymentFulfillment.create).toHaveBeenCalledWith({
        data: { stripeRef: "pi_9", userId: USER, kind: "equipment" },
      });
      expect(fulfilEquipmentCheckout).toHaveBeenCalledWith("chk_1", USER, "pi_9");
      expect(order).toEqual(["record", "book"]);
      expect(result).toMatchObject({ success: true, paymentIntentId: "pi_9", type: "equipment" });
    });

    it("says the card was charged when booking fails afterwards, and releases the record for a retry", async () => {
      (fulfilEquipmentCheckout as jest.Mock).mockRejectedValue(
        new MockEquipmentBookingError("That time is already booked or reserved. Please choose another time.")
      );
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await quickCheckout(USER, { type: "equipment", equipmentId: 1, slots: SLOTS });

      expect(result).toMatchObject({ success: false, type: "equipment", paymentIntentId: "pi_9" });
      expect((result as any).error).toMatch(/^Your card was charged/);
      expect(m.db.paymentFulfillment.deleteMany).toHaveBeenCalledWith({ where: { stripeRef: "pi_9" } });
      consoleError.mockRestore();
    });

    it("books free equipment directly, without a charge", async () => {
      (prepareEquipmentBooking as jest.Mock).mockResolvedValue({
        equipment: { id: 1, name: "Sewing Machine", price: 0 },
        slots: HELD,
        amount: 0,
      });

      const result = await quickCheckout(USER, { type: "equipment", equipmentId: 1, slots: SLOTS });

      expect(bookEquipmentBulkByTimes).toHaveBeenCalledWith(USER, 1, HELD);
      expect(m.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({ success: true, amount: 0 });
    });
  });

  describe("workshop", () => {
    it("tells a member with no saved card to use the regular checkout instead of erroring", async () => {
      m.mockGetSavedPaymentMethod.mockResolvedValue(null);

      const result = await quickCheckout(USER, { type: "workshop", workshopId: 1, occurrenceId: 10 } as any);

      expect(result).toMatchObject({
        success: false,
        error: "You have no saved card. Please use the regular checkout below.",
      });
      expect(m.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
      expect(registerForWorkshop).not.toHaveBeenCalled();
    });

    it("charges the workshop's own price, not one sent with the request", async () => {
      await quickCheckout(USER, { type: "workshop", workshopId: 1, occurrenceId: 10, price: 0.01 } as any);

      expect(charged().amount).toBe(3150);
      expect(registerForWorkshop).toHaveBeenCalledWith(1, 10, USER, null, "pi_9");
      expect(m.db.paymentFulfillment.create).toHaveBeenCalledWith({
        data: { stripeRef: "pi_9", userId: USER, kind: "workshop" },
      });
    });

    it("refuses a price variation from another workshop and charges nothing", async () => {
      (getWorkshopPriceVariation as jest.Mock).mockResolvedValue({ id: 5, workshopId: 2, name: "Free", price: 0 });

      const result = await quickCheckout(USER, { type: "workshop", workshopId: 1, occurrenceId: 10, variationId: 5 });

      expect(result).toEqual({
        success: false,
        error: "That price option does not belong to this workshop.",
        type: "workshop",
      });
      expect(m.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    });

    it("reports a registration that fails after the charge instead of claiming success", async () => {
      (registerForWorkshop as jest.Mock).mockRejectedValue(new Error("Workshop is full."));
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await quickCheckout(USER, { type: "workshop", workshopId: 1, occurrenceId: 10 });

      expect(result).toMatchObject({ success: false, paymentIntentId: "pi_9" });
      expect(m.db.paymentFulfillment.deleteMany).toHaveBeenCalledWith({ where: { stripeRef: "pi_9" } });
      consoleError.mockRestore();
    });
  });

  describe("membership", () => {
    it("charges the plan's price for the chosen cycle", async () => {
      const result = await quickCheckout(USER, {
        type: "membership",
        membershipPlanId: 2,
        billingCycle: "yearly",
        price: 1,
      } as any);

      expect(charged().amount).toBe(52500);
      expect(registerMembershipSubscription).toHaveBeenCalledWith(USER, 2, null, false, false, "pi_9", "yearly", true);
      expect(activateMembershipForm).toHaveBeenCalledWith(USER, 2, 31);
      expect(result).toMatchObject({ success: true });
    });

    it("refuses a cycle the plan has no price for", async () => {
      const result = await quickCheckout(USER, { type: "membership", membershipPlanId: 2, billingCycle: "quarterly" });

      expect(result).toMatchObject({ success: false, type: "membership" });
      expect(m.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    });

    it("refuses an upgrade from someone else's membership", async () => {
      (getOwnedMembership as jest.Mock).mockRejectedValue(
        new MembershipChangeError("That membership could not be found on your account.")
      );

      const result = await quickCheckout(USER, { type: "membership", membershipPlanId: 2, currentMembershipId: 77 });

      expect(result).toEqual({
        success: false,
        error: "That membership could not be found on your account.",
        type: "membership",
      });
      expect(m.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    });
  });
});

describe("payment fulfilment records (D3)", () => {
  const m = getPaymentMocks();

  beforeEach(() => {
    clearAllMocks();
    resetPaymentMocks();
  });

  it("claims a Stripe payment the first time", async () => {
    m.db.paymentFulfillment.create.mockResolvedValue({});

    await expect(claimPaymentFulfillment("cs_1", 4, "membership")).resolves.toBe(true);
    expect(m.db.paymentFulfillment.create).toHaveBeenCalledWith({
      data: { stripeRef: "cs_1", userId: 4, kind: "membership" },
    });
  });

  it("reports a payment that was already fulfilled", async () => {
    m.db.paymentFulfillment.create.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }));

    await expect(claimPaymentFulfillment("cs_1", 4, "membership")).resolves.toBe(false);
  });

  it("does not hide any other database error", async () => {
    m.db.paymentFulfillment.create.mockRejectedValue(new Error("connection lost"));

    await expect(claimPaymentFulfillment("cs_1", 4, "membership")).rejects.toThrow("connection lost");
  });

  it("releases a claim so a reload can retry", async () => {
    m.db.paymentFulfillment.deleteMany.mockResolvedValue({ count: 1 });

    await releasePaymentFulfillment("cs_1");

    expect(m.db.paymentFulfillment.deleteMany).toHaveBeenCalledWith({ where: { stripeRef: "cs_1" } });
  });
});
