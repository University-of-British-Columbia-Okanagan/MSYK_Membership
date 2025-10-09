import "tests/fixtures/equipment/setup";

import { getEquipmentMocks } from "tests/fixtures/equipment/setup";
import {
  createMockEquipment,
  createMockSlot,
  createMockBooking,
} from "tests/fixtures/equipment/equipments";
import { clearAllMocks, createMockRequest } from "tests/helpers/test-utils";
import {
  bookEquipment,
  bookEquipmentBulkByTimes,
  approveEquipmentBooking,
  cancelEquipmentBooking,
  getBookingEmailDetails,
  getUserBookedEquipments,
  getCancelledEquipmentBookings,
} from "~/models/equipment.server";

describe("equipment.server - Booking", () => {
  let db: any;
  let mockGetUserId: jest.Mock;
  let mockSendEquipmentConfirmationEmail: jest.Mock;
  let mockSendEquipmentBulkConfirmationEmail: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getEquipmentMocks();
    db = mocks.db;
    mockGetUserId = mocks.mockGetUserId;
    mockSendEquipmentConfirmationEmail =
      mocks.mockSendEquipmentConfirmationEmail;
    mockSendEquipmentBulkConfirmationEmail =
      mocks.mockSendEquipmentBulkConfirmationEmail;
  });

  describe("bookEquipment", () => {
    it("creates slot and booking for level 3 user within allowed hours", async () => {
      mockGetUserId.mockResolvedValue("1");
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 5, isBooked: false });
      db.equipmentSlot.update.mockResolvedValue({});
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 10 });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());
      db.user.findUnique.mockResolvedValue({ id: 1, email: "jane@example.com" });
      // Ensure consolidated email path has the required data
      db.user.findUnique.mockResolvedValue({ id: 1, email: "jane@example.com" });

      const request = createMockRequest();
      const result = await bookEquipment(
        request,
        1,
        "2025-12-01T12:00:00",
        "2025-12-01T12:30:00"
      );

      expect(result.id).toBe(10);
      expect(db.equipmentSlot.create).toHaveBeenCalled();
      expect(db.equipmentBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ equipmentId: 1, status: "pending" }),
      });
      expect(mockSendEquipmentConfirmationEmail).toHaveBeenCalled();
    });

    it("reuses existing slot and updates cancelled booking", async () => {
      mockGetUserId.mockResolvedValue("1");
      const slot = { id: 5, isBooked: false };
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(slot);
      db.equipmentSlot.update.mockResolvedValue({});
      db.equipmentBooking.findFirst.mockResolvedValue({
        id: 2,
        status: "cancelled",
      });
      db.equipmentBooking.update.mockResolvedValue({ id: 2, status: "pending" });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());

      const request = createMockRequest();
      const result = await bookEquipment(
        request,
        1,
        "2025-12-01T12:00:00",
        "2025-12-01T12:30:00"
      );

      expect(result.id).toBe(2);
      expect(db.equipmentSlot.create).not.toHaveBeenCalled();
      expect(db.equipmentBooking.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: expect.objectContaining({ status: "pending", bookedFor: "user" }),
      });
    });

    it("rejects level 3 booking outside allowed hours", async () => {
      mockGetUserId.mockResolvedValue("1");
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });

      await expect(
        bookEquipment(
          createMockRequest(),
          1,
          "2025-12-01T05:00:00Z",
          "2025-12-01T05:30:00Z"
        )
      ).rejects.toThrow("Level 3 members can only book between 9 AM and 5 PM.");
    });

    it("rejects role level 1 users", async () => {
      mockGetUserId.mockResolvedValue("1");
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 1, roleUserId: 1 });

      await expect(
        bookEquipment(
          createMockRequest(),
          1,
          "2025-12-01T15:00:00Z",
          "2025-12-01T15:30:00Z"
        )
      ).rejects.toThrow("You do not have permission to book equipment.");
    });
  });

  describe("bookEquipmentBulkByTimes", () => {
    it("books multiple slots and sends consolidated email", async () => {
      mockGetUserId.mockResolvedValue("1");
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 11, isBooked: false });
      db.equipmentSlot.update.mockResolvedValue({});
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 21 });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());

      const request = createMockRequest();

      const result = await bookEquipmentBulkByTimes(request, 1, [
        {
          startTime: "2025-12-01T12:00:00",
          endTime: "2025-12-01T12:30:00",
        },
        {
          startTime: "2025-12-01T12:30:00",
          endTime: "2025-12-01T13:00:00",
        },
      ]);

      expect(result.count).toBe(2);
    });
  });

  describe("approveEquipmentBooking", () => {
    it("sets booking status to approved", async () => {
      db.equipmentBooking.update.mockResolvedValue({ id: 1, status: "approved" });

      const result = await approveEquipmentBooking(1);

      expect(result.status).toBe("approved");
      expect(db.equipmentBooking.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "approved" },
      });
    });
  });

  describe("cancelEquipmentBooking", () => {
    it("frees slot, records cancellation, updates booking", async () => {
      const booking = createMockBooking({
        id: 1,
        paymentIntentId: "pi_123",
        equipment: createMockEquipment({ price: 30 }),
      });

      db.equipmentBooking.findUnique.mockResolvedValue(booking);
      db.equipmentSlot.update.mockResolvedValue({});
      db.equipmentCancelledBooking.findMany.mockResolvedValue([]);
      db.equipmentBooking.findMany.mockResolvedValue([booking]);
      db.equipmentCancelledBooking.create.mockResolvedValue({ id: 99 });
      db.equipmentBooking.update.mockResolvedValue({ id: 1, status: "cancelled" });

      const result = await cancelEquipmentBooking(1);

      expect(result.status).toBe("cancelled");
      expect(db.equipmentSlot.update).toHaveBeenCalledWith({
        where: { id: booking.slot.id },
        data: { isBooked: false },
      });
      expect(db.equipmentCancelledBooking.create).toHaveBeenCalled();
    });
  });

  describe("getBookingEmailDetails", () => {
    it("returns booking email details", async () => {
      const booking = createMockBooking();
      db.equipmentBooking.findUnique.mockResolvedValue(booking);

      const result = await getBookingEmailDetails(1);

      expect(result).toEqual({
        userEmail: booking.user.email,
        equipmentName: booking.equipment.name,
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime,
      });
    });
  });

  describe("getUserBookedEquipments", () => {
    it("returns mapped bookingsexcluding cancelled", async () => {
      const booking = createMockBooking({ status: "pending" });
      db.equipmentBooking.findMany.mockResolvedValue([booking]);

      const result = await getUserBookedEquipments(1);

      expect(result[0]).toEqual(
        expect.objectContaining({
          id: booking.id,
          name: booking.equipment.name,
          status: "booked",
        })
      );
    });
  });

  describe("getCancelledEquipmentBookings", () => {
    it("returns cancelled bookings with relations", async () => {
      const booking = createMockBooking({ status: "cancelled" });
      db.equipmentBooking.findMany.mockResolvedValue([booking]);

      const result = await getCancelledEquipmentBookings();

      expect(result).toHaveLength(1);
      expect(db.equipmentBooking.findMany).toHaveBeenCalledWith({
        where: { status: "cancelled" },
        include: expect.any(Object),
        orderBy: { id: "desc" },
      });
    });
  });
});

