import "tests/fixtures/payment/setup";

import { getPaymentMocks, resetPaymentMocks } from "tests/fixtures/payment/setup";
import type { PaymentDbMock } from "tests/fixtures/payment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  refundWorkshopRegistration,
  refundEquipmentBooking,
  deletePaymentMethod,
} from "~/models/payment.server";

const succeededRefund = (overrides?: Record<string, unknown>) => ({
  id: "re_123",
  status: "succeeded",
  amount: 10500,
  ...overrides,
});

describe("payment.server - refunds and payment method removal", () => {
  let db: PaymentDbMock;
  let stripeRefundsCreateMock: jest.Mock;
  let stripePaymentMethodsDetachMock: jest.Mock;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    clearAllMocks();
    resetPaymentMocks();
    const mocks = getPaymentMocks();
    db = mocks.db;
    stripeRefundsCreateMock = mocks.stripeRefundsCreateMock;
    stripePaymentMethodsDetachMock = mocks.stripePaymentMethodsDetachMock;
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  describe("refundWorkshopRegistration", () => {
    it("refunds against the stored payment intent and converts cents to dollars", async () => {
      db.userWorkshop.findMany.mockResolvedValue([
        { id: 1, paymentIntentId: "pi_abc" },
      ]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());
      db.userWorkshop.deleteMany.mockResolvedValue({ count: 1 });

      const result = await refundWorkshopRegistration(1, 2, 3);

      expect(stripeRefundsCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: "pi_abc" })
      );
      expect(result).toEqual({
        success: true,
        refundId: "re_123",
        amount: 105,
        status: "succeeded",
      });
    });

    it("only considers registrations that were actually paid for", async () => {
      db.userWorkshop.findMany.mockResolvedValue([
        { id: 1, paymentIntentId: "pi_abc" },
      ]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());

      await refundWorkshopRegistration(1, 2);

      expect(db.userWorkshop.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 1,
          workshopId: 2,
          paymentIntentId: { not: null },
        }),
      });
    });

    it("scopes to a single occurrence when one is given", async () => {
      db.userWorkshop.findMany.mockResolvedValue([
        { id: 1, paymentIntentId: "pi_abc" },
      ]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());

      await refundWorkshopRegistration(1, 2, 9);

      expect(db.userWorkshop.findMany.mock.calls[0][0].where.occurrenceId).toBe(
        9
      );
    });

    it("refunds a multi-day series as one payment intent and deletes every row", async () => {
      db.userWorkshop.findMany.mockResolvedValue([
        { id: 1, paymentIntentId: "pi_multi" },
        { id: 2, paymentIntentId: "pi_multi" },
        { id: 3, paymentIntentId: "pi_multi" },
      ]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());
      db.userWorkshop.deleteMany.mockResolvedValue({ count: 3 });

      await refundWorkshopRegistration(1, 2);

      expect(stripeRefundsCreateMock).toHaveBeenCalledTimes(1);
      expect(db.userWorkshop.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ paymentIntentId: "pi_multi" }),
      });
    });

    it("throws when there is nothing paid to refund", async () => {
      db.userWorkshop.findMany.mockResolvedValue([]);

      await expect(refundWorkshopRegistration(1, 2)).rejects.toThrow(
        "Refund failed: No paid registration found for refund"
      );
      expect(stripeRefundsCreateMock).not.toHaveBeenCalled();
    });

    it("keeps the registration when Stripe does not report success", async () => {
      db.userWorkshop.findMany.mockResolvedValue([
        { id: 1, paymentIntentId: "pi_abc" },
      ]);
      stripeRefundsCreateMock.mockResolvedValue(
        succeededRefund({ status: "pending" })
      );

      const result = await refundWorkshopRegistration(1, 2);

      expect(result.success).toBe(false);
      expect(db.userWorkshop.deleteMany).not.toHaveBeenCalled();
    });

    it("surfaces a Stripe failure with its message", async () => {
      db.userWorkshop.findMany.mockResolvedValue([
        { id: 1, paymentIntentId: "pi_abc" },
      ]);
      stripeRefundsCreateMock.mockRejectedValue(new Error("charge disputed"));

      await expect(refundWorkshopRegistration(1, 2)).rejects.toThrow(
        "Refund failed: charge disputed"
      );
      expect(db.userWorkshop.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("refundEquipmentBooking", () => {
    const booking = (id: number, slotId: number, pi = "pi_equip") => ({
      id,
      slotId,
      paymentIntentId: pi,
      slot: { id: slotId },
      equipment: { id: 1 },
    });

    it("frees the slots and removes the bookings on success", async () => {
      db.equipmentBooking.findMany.mockResolvedValue([
        booking(1, 11),
        booking(2, 12),
      ]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());
      db.equipmentSlot.updateMany.mockResolvedValue({ count: 2 });
      db.equipmentBooking.deleteMany.mockResolvedValue({ count: 2 });

      const result = await refundEquipmentBooking(1, 1);

      expect(db.equipmentSlot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [11, 12] } },
        data: { isBooked: false },
      });
      expect(db.equipmentBooking.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          bookingsRefunded: 2,
          slotsFreed: 2,
        })
      );
    });

    it("excludes workshop-attached bookings from user refunds", async () => {
      db.equipmentBooking.findMany.mockResolvedValue([booking(1, 11)]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());

      await refundEquipmentBooking(1);

      expect(db.equipmentBooking.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          userId: 1,
          bookedFor: "user",
          paymentIntentId: { not: null },
        })
      );
    });

    it("narrows to the given slots for a partial cancellation", async () => {
      db.equipmentBooking.findMany.mockResolvedValue([booking(1, 11)]);
      stripeRefundsCreateMock.mockResolvedValue(succeededRefund());

      await refundEquipmentBooking(1, 1, [11, 12]);

      expect(db.equipmentBooking.findMany.mock.calls[0][0].where.slotId).toEqual(
        { in: [11, 12] }
      );
    });

    it("refuses to refund bookings that came from different payments", async () => {
      db.equipmentBooking.findMany.mockResolvedValue([
        booking(1, 11, "pi_one"),
        booking(2, 12, "pi_two"),
      ]);

      await expect(refundEquipmentBooking(1, 1)).rejects.toThrow(
        "Cannot refund bookings from different payments together"
      );
      expect(stripeRefundsCreateMock).not.toHaveBeenCalled();
    });

    it("throws when there is nothing paid to refund", async () => {
      db.equipmentBooking.findMany.mockResolvedValue([]);

      await expect(refundEquipmentBooking(1, 1)).rejects.toThrow(
        "Equipment refund failed: No paid equipment bookings found for refund"
      );
    });

    it("leaves slots booked when the refund does not succeed", async () => {
      db.equipmentBooking.findMany.mockResolvedValue([booking(1, 11)]);
      stripeRefundsCreateMock.mockResolvedValue(
        succeededRefund({ status: "failed" })
      );

      const result = await refundEquipmentBooking(1, 1);

      expect(result.success).toBe(false);
      expect(db.equipmentSlot.updateMany).not.toHaveBeenCalled();
      expect(db.equipmentBooking.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("deletePaymentMethod", () => {
    it("detaches from Stripe, clears the record, and disables auto-renew", async () => {
      db.userPaymentInformation.findUnique.mockResolvedValue({
        stripePaymentMethodId: "pm_123",
      });
      stripePaymentMethodsDetachMock.mockResolvedValue({});
      db.userPaymentInformation.deleteMany.mockResolvedValue({ count: 1 });
      db.userMembership.updateMany.mockResolvedValue({ count: 1 });

      const result = await deletePaymentMethod(5);

      expect(stripePaymentMethodsDetachMock).toHaveBeenCalledWith("pm_123");
      expect(db.userPaymentInformation.deleteMany).toHaveBeenCalledWith({
        where: { userId: 5 },
      });
      // Documented behaviour: removing the card turns auto-renew off so the
      // membership expires rather than failing to charge.
      expect(db.userMembership.updateMany).toHaveBeenCalledWith({
        where: { userId: 5, status: { in: ["active", "ending", "cancelled"] } },
        data: { autoRenew: false },
      });
      expect(result).toEqual({ success: true, deleted: true });
    });

    it("still clears local state when there is nothing to detach", async () => {
      db.userPaymentInformation.findUnique.mockResolvedValue(null);
      db.userPaymentInformation.deleteMany.mockResolvedValue({ count: 0 });
      db.userMembership.updateMany.mockResolvedValue({ count: 0 });

      await expect(deletePaymentMethod(5)).resolves.toEqual({
        success: true,
        deleted: true,
      });
      expect(stripePaymentMethodsDetachMock).not.toHaveBeenCalled();
    });

    it("wraps a failure in a user-facing message", async () => {
      db.userPaymentInformation.findUnique.mockResolvedValue({
        stripePaymentMethodId: "pm_123",
      });
      stripePaymentMethodsDetachMock.mockRejectedValue(new Error("api down"));

      await expect(deletePaymentMethod(5)).rejects.toThrow(
        "Failed to delete payment method. Please try again."
      );
    });
  });
});
