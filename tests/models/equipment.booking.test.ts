import "tests/fixtures/equipment/setup";

import {
  ADMIN_SETTING_TEST_DEFAULTS,
  getEquipmentMocks,
} from "tests/fixtures/equipment/setup";
import {
  createMockEquipment,
  createMockSlot,
  createMockBooking,
} from "tests/fixtures/equipment/equipments";
import { clearAllMocks } from "tests/helpers/test-utils";
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
  let mockSendEquipmentConfirmationEmail: jest.Mock;
  let mockSendEquipmentBulkConfirmationEmail: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getEquipmentMocks();
    db = mocks.db;
    mockSendEquipmentConfirmationEmail =
      mocks.mockSendEquipmentConfirmationEmail;
    mockSendEquipmentBulkConfirmationEmail =
      mocks.mockSendEquipmentBulkConfirmationEmail;
  });

  describe("bookEquipment", () => {
    it("creates slot and booking for level 3 user within allowed hours", async () => {
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

      const result = await bookEquipment(
        1,
        1,
        "2025-12-01T12:00:00",
        "2025-12-01T12:30:00"
      );

      expect(result.id).toBe(10);
      expect(db.equipmentSlot.create).toHaveBeenCalled();
      expect(db.equipmentBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 1, equipmentId: 1, status: "pending" }),
      });
      expect(mockSendEquipmentConfirmationEmail).toHaveBeenCalled();
    });

    it("reuses existing slot and updates cancelled booking", async () => {
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

      const result = await bookEquipment(
        1,
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
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });

      await expect(
        bookEquipment(
          1,
          1,
          "2025-12-01T05:00:00Z",
          "2025-12-01T05:30:00Z"
        )
      ).rejects.toThrow(
        // Message is built per-day from level3_start_end_hours, not hardcoded
        /Level 3 members can only book between 9 AM and 5 PM on \w+/
      );
    });

    // Level 3 hours are NWT business hours (UTC-6). These instants read
    // differently on any other host clock, including a Vancouver dev machine.
    it("accepts a level 3 booking at 09:30 business time on a 9-17 weekday", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 5, isBooked: false });
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 10 });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());

      await bookEquipment(
        1,
        1,
        "2026-11-16T15:30:00.000Z", // Mon 09:30 business
        "2026-11-16T16:00:00.000Z"
      );

      expect(db.equipmentSlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startTime: new Date("2026-11-16T15:30:00.000Z"),
        }),
      });
    });

    it("rejects a level 3 booking at 17:30 business time on a 9-17 weekday", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });

      await expect(
        bookEquipment(
          1,
          1,
          "2026-11-16T23:30:00.000Z", // Mon 17:30 business
          "2026-11-17T00:00:00.000Z"
        )
      ).rejects.toThrow(/on Monday/);
      expect(db.equipmentSlot.create).not.toHaveBeenCalled();
    });

    it("checks a level 3 closed day by the business weekday, not the UTC one", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      getEquipmentMocks().mockGetAdminSetting.mockImplementationOnce(
        async (key: string, fallback?: string) =>
          key === "level3_start_end_hours"
            ? JSON.stringify({
                ...JSON.parse(ADMIN_SETTING_TEST_DEFAULTS.level3_start_end_hours),
                Monday: { start: 9, end: 23 },
                Tuesday: { start: 9, end: 17, closed: true },
              })
            : ADMIN_SETTING_TEST_DEFAULTS[key] ?? fallback ?? ""
      );
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 5, isBooked: false });
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 10 });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());

      // Tuesday 04:00 in UTC, but Monday 22:00 in Yellowknife.
      await expect(
        bookEquipment(
          1,
          1,
          "2026-11-17T04:00:00.000Z",
          "2026-11-17T04:30:00.000Z"
        )
      ).resolves.toEqual({ id: 10 });
    });

    it("reads an offset-less time as business wall time", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 5, isBooked: false });
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 10 });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());

      await bookEquipment(1, 1, "2026-11-16T10:00", "2026-11-16T10:30");

      expect(db.equipmentSlot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startTime: new Date("2026-11-16T16:00:00.000Z"),
          endTime: new Date("2026-11-16T16:30:00.000Z"),
        }),
      });
    });

    it("rejects an unparseable time instead of booking it", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 4, roleUserId: 1 });

      await expect(
        bookEquipment(1, 1, "not a date", "also not")
      ).rejects.toThrow("Invalid booking time.");
      expect(db.equipmentSlot.create).not.toHaveBeenCalled();
    });

    describe("level 4 restricted hours and planned closures", () => {
      const level4Window = (start: number, end: number) =>
        db.adminSettings.findUnique.mockImplementation(async ({ where }: any) =>
          where.key === "level4_unavaliable_hours" ? { value: JSON.stringify({ start, end }) } : null
        );
      const readyToBook = () => {
        db.equipmentSlot.findFirst.mockResolvedValue(null);
        db.equipmentSlot.create.mockResolvedValue({ id: 5, isBooked: false });
        db.equipmentBooking.findFirst.mockResolvedValue(null);
        db.equipmentBooking.create.mockResolvedValue({ id: 10 });
        db.equipment.findUnique.mockResolvedValue(createMockEquipment());
      };

      it("rejects a level 4 booking inside the restricted window, on the NWT clock", async () => {
        db.user.findUnique.mockResolvedValue({ id: 6, roleLevel: 4, roleUserId: 1 });
        level4Window(22, 6);

        await expect(
          bookEquipment(6, 1, "2026-11-17T05:00:00.000Z", "2026-11-17T05:30:00.000Z") // Mon 23:00 NWT
        ).rejects.toThrow("Level 4 members cannot book between 10 PM and 6 AM.");
        expect(db.equipmentSlot.create).not.toHaveBeenCalled();
        expect(db.equipmentBooking.create).not.toHaveBeenCalled();
      });

      it("allows a level 4 booking outside the restricted window", async () => {
        db.user.findUnique.mockResolvedValue({ id: 6, roleLevel: 4, roleUserId: 1 });
        level4Window(22, 6);
        readyToBook();

        const booking = await bookEquipment(6, 1, "2026-11-17T03:00:00.000Z", "2026-11-17T03:30:00.000Z"); // Mon 21:00 NWT
        expect(booking.id).toBe(10);
      });

      it("rejects a level 3 booking inside a planned closure", async () => {
        db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
        getEquipmentMocks().mockGetPlannedClosures.mockResolvedValueOnce([
          { id: 1, startDate: new Date("2026-11-16T19:00:00.000Z"), endDate: new Date("2026-11-16T21:00:00.000Z") },
        ]);

        await expect(
          bookEquipment(1, 1, "2026-11-16T19:30:00.000Z", "2026-11-16T20:00:00.000Z") // Mon 13:30 NWT
        ).rejects.toThrow("That time falls in a planned closure. Please choose another time.");
        expect(db.equipmentBooking.create).not.toHaveBeenCalled();
      });

      it("does not hold a level 4 member to planned closures, matching the grid", async () => {
        db.user.findUnique.mockResolvedValue({ id: 6, roleLevel: 4, roleUserId: 1 });
        getEquipmentMocks().mockGetPlannedClosures.mockResolvedValue([
          { id: 1, startDate: new Date("2026-11-16T19:00:00.000Z"), endDate: new Date("2026-11-16T21:00:00.000Z") },
        ]);
        readyToBook();

        const booking = await bookEquipment(6, 1, "2026-11-16T19:30:00.000Z", "2026-11-16T20:00:00.000Z");
        expect(booking.id).toBe(10);
        getEquipmentMocks().mockGetPlannedClosures.mockResolvedValue([]);
      });
    });

    it("rejects role level 1 users", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 1, roleUserId: 1 });

      await expect(
        bookEquipment(
          1,
          1,
          "2025-12-01T15:00:00Z",
          "2025-12-01T15:30:00Z"
        )
      ).rejects.toThrow("You do not have permission to book equipment.");
    });
  });

  describe("bookEquipmentBulkByTimes", () => {
    it("books multiple slots and sends consolidated email", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 11, isBooked: false });
      db.equipmentSlot.update.mockResolvedValue({});
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 21 });
      db.equipment.findUnique.mockResolvedValue(createMockEquipment());

      db.equipmentBooking.findMany.mockResolvedValue([]);

      const result = await bookEquipmentBulkByTimes(1, 1, [
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

  describe("bookEquipmentBulkByTimes rule checks", () => {
    it("checks every slot before booking any, so one bad slot books nothing", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 3, roleUserId: 1 });
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.create.mockResolvedValue({ id: 11, isBooked: false });
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 21 });

      await expect(
        bookEquipmentBulkByTimes(1, 1, [
          { startTime: "2026-11-16T22:30:00.000Z", endTime: "2026-11-16T23:00:00.000Z" }, // 16:30 ok
          { startTime: "2026-11-16T23:00:00.000Z", endTime: "2026-11-16T23:30:00.000Z" }, // 17:00 outside 9-17
        ])
      ).rejects.toThrow(/between 9 AM and 5 PM on Monday/);
      expect(db.equipmentSlot.create).not.toHaveBeenCalled();
      expect(db.equipmentBooking.create).not.toHaveBeenCalled();
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

