import "tests/fixtures/equipment/setup";

import { ADMIN_SETTING_TEST_DEFAULTS, getEquipmentMocks } from "tests/fixtures/equipment/setup";
import { createMockEquipment } from "tests/fixtures/equipment/equipments";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  assertEquipmentSlotLimits,
  bookEquipmentBulkByTimes,
  createEquipmentCheckout,
  fulfilEquipmentCheckout,
  prepareEquipmentBooking,
} from "~/models/equipment.server";

// Mon 16 Nov 2026, 09:00 NWT (UTC-6).
const NOW = new Date("2026-11-16T15:00:00.000Z");
const HALF_HOUR = 30 * 60 * 1000;

/** A grid slot string for a slot starting at `iso`. */
const slot = (iso: string) => `${iso}|${new Date(new Date(iso).getTime() + HALF_HOUR).toISOString()}`;
/** `count` consecutive half-hour starts from `iso`. */
const run = (iso: string, count: number) =>
  Array.from({ length: count }, (_, i) => new Date(new Date(iso).getTime() + i * HALF_HOUR));
const existing = (starts: Date[]) =>
  starts.map((startTime, i) => ({ slotId: 900 + i, slot: { startTime } }));

describe("equipment.server - server-held equipment checkout", () => {
  let db: any;

  const settings = (overrides: Record<string, string>) =>
    getEquipmentMocks().mockGetAdminSetting.mockImplementation(
      async (key: string, fallback?: string) =>
        overrides[key] ?? ADMIN_SETTING_TEST_DEFAULTS[key] ?? fallback ?? ""
    );

  beforeEach(() => {
    clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    settings({});
    db = getEquipmentMocks().db;
    db.user.findUnique.mockResolvedValue({ id: 6, roleLevel: 4, roleUserId: 1, email: "m@example.com" });
    db.equipment.findUnique.mockResolvedValue(createMockEquipment({ id: 1, price: 20 }));
    db.equipmentSlot.findFirst.mockResolvedValue(null);
    db.equipmentBooking.findMany.mockResolvedValue([]);
    db.adminSettings.findUnique.mockResolvedValue(null);
  });

  afterEach(() => jest.useRealTimers());

  describe("prepareEquipmentBooking", () => {
    it("prices the booking as equipment price times the slots held, from the server", async () => {
      const prepared = await prepareEquipmentBooking(6, 1, [
        slot("2026-11-16T18:00:00.000Z"),
        slot("2026-11-16T18:30:00.000Z"),
        slot("2026-11-16T19:00:00.000Z"),
      ]);

      expect(prepared.amount).toBe(60);
      expect(prepared.slots).toEqual([
        { startTime: "2026-11-16T18:00:00.000Z", endTime: "2026-11-16T18:30:00.000Z" },
        { startTime: "2026-11-16T18:30:00.000Z", endTime: "2026-11-16T19:00:00.000Z" },
        { startTime: "2026-11-16T19:00:00.000Z", endTime: "2026-11-16T19:30:00.000Z" },
      ]);
    });

    it("accepts the JSON string the booking form posts", async () => {
      const prepared = await prepareEquipmentBooking(6, 1, JSON.stringify([slot("2026-11-16T18:00:00.000Z")]));
      expect(prepared.slots).toHaveLength(1);
    });

    it.each([
      ["nothing", undefined],
      ["an empty list", []],
      ["garbage", "not json"],
    ])("refuses %s as the slot list", async (_label, raw) => {
      await expect(prepareEquipmentBooking(6, 1, raw)).rejects.toThrow(
        "Your selected times were not received. Please reselect them and try again."
      );
    });

    it("refuses a slot that is not exactly one half hour, so one slot's price cannot buy ten hours", async () => {
      await expect(
        prepareEquipmentBooking(6, 1, ["2026-11-16T18:00:00.000Z|2026-11-17T04:00:00.000Z"])
      ).rejects.toThrow("Invalid booking time.");
    });

    it("refuses a slot that does not start on the half hour", async () => {
      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-16T18:10:00.000Z")])).rejects.toThrow(
        "Invalid booking time."
      );
    });

    it("refuses the same slot twice", async () => {
      await expect(
        prepareEquipmentBooking(6, 1, [slot("2026-11-16T18:00:00.000Z"), slot("2026-11-16T18:00:00.000Z")])
      ).rejects.toThrow("Each time can only be selected once.");
    });

    it("refuses a slot in the past", async () => {
      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-16T14:00:00.000Z")])).rejects.toThrow(
        "Cannot book slots in the past."
      );
    });

    it("refuses a slot beyond the bookable window", async () => {
      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-24T18:00:00.000Z")])).rejects.toThrow(
        "That time is outside the booking window. Please choose another time."
      );
    });

    it.each([
      ["booked by someone", { id: 3, isBooked: true, workshopOccurrenceId: null }],
      ["reserved for a workshop", { id: 3, isBooked: false, workshopOccurrenceId: 12 }],
    ])("refuses a slot that is %s", async (_label, taken) => {
      db.equipmentSlot.findFirst.mockResolvedValue(taken);

      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-16T18:00:00.000Z")])).rejects.toThrow(
        "That time is already booked or reserved. Please choose another time."
      );
    });

    it("refuses a member below level 3 who is not an admin", async () => {
      db.user.findUnique.mockResolvedValue({ id: 4, roleLevel: 2, roleUserId: 1 });

      await expect(prepareEquipmentBooking(4, 1, [slot("2026-11-16T18:00:00.000Z")])).rejects.toThrow(
        "You do not have permission to book equipment."
      );
    });

    it("lets an admin book below level 3, as bookEquipment does", async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 1, roleUserId: 2 });

      await expect(prepareEquipmentBooking(1, 1, [slot("2026-11-16T18:00:00.000Z")])).resolves.toMatchObject({
        amount: 20,
      });
    });

    it("refuses equipment that is switched off, unless the booker is an admin", async () => {
      db.equipment.findUnique.mockResolvedValue(createMockEquipment({ availability: false }));

      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-16T18:00:00.000Z")])).rejects.toThrow(
        "This equipment is not available for booking."
      );

      db.user.findUnique.mockResolvedValue({ id: 1, roleLevel: 1, roleUserId: 2 });
      await expect(prepareEquipmentBooking(1, 1, [slot("2026-11-16T18:00:00.000Z")])).resolves.toBeDefined();
    });

    it("refuses a member who has not completed the equipment's prerequisites", async () => {
      db.equipment.findUnique.mockResolvedValue(
        createMockEquipment({ prerequisites: [{ workshopPrerequisiteId: 77 }] })
      );
      db.userWorkshop.findMany.mockResolvedValue([]);

      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-16T18:00:00.000Z")])).rejects.toThrow(
        "You must complete the required orientation before booking this equipment."
      );
    });

    it("applies the member's level rules", async () => {
      db.adminSettings.findUnique.mockResolvedValue({ value: JSON.stringify({ start: 22, end: 6 }) });

      await expect(prepareEquipmentBooking(6, 1, [slot("2026-11-17T05:00:00.000Z")])).rejects.toThrow(
        "Level 4 members cannot book between 10 PM and 6 AM."
      );
    });

    it("applies the daily slot limit", async () => {
      db.equipmentBooking.findMany.mockResolvedValue(existing(run("2026-11-16T16:00:00.000Z", 3)));

      await expect(
        prepareEquipmentBooking(6, 1, [slot("2026-11-16T18:00:00.000Z"), slot("2026-11-16T18:30:00.000Z")])
      ).rejects.toThrow("You can only select up to 2 hours (4 slots) per day.");
    });
  });

  describe("assertEquipmentSlotLimits: the grid's daily and 7-day counts, on the server", () => {
    it("counts only this member's live bookings of this equipment inside the grid's window", async () => {
      await assertEquipmentSlotLimits(6, 1, run("2026-11-16T18:00:00.000Z", 1));

      expect(db.equipmentBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 6,
            equipmentId: 1,
            status: { not: "cancelled" },
            slot: {
              startTime: {
                // Business midnight today to business midnight 7 days on.
                gte: new Date("2026-11-16T06:00:00.000Z"),
                lt: new Date("2026-11-23T06:00:00.000Z"),
              },
            },
          },
        })
      );
    });

    it("allows the day to fill up to the limit", async () => {
      db.equipmentBooking.findMany.mockResolvedValue(existing(run("2026-11-16T16:00:00.000Z", 2)));

      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-16T18:00:00.000Z", 2))).resolves.toBeUndefined();
    });

    it("refuses a day that would go over the limit", async () => {
      db.equipmentBooking.findMany.mockResolvedValue(existing(run("2026-11-16T16:00:00.000Z", 3)));

      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-16T18:00:00.000Z", 2))).rejects.toThrow(
        "You can only select up to 2 hours (4 slots) per day."
      );
    });

    it("refuses new slots that alone exceed the daily limit", async () => {
      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-16T18:00:00.000Z", 5))).rejects.toThrow(
        "per day"
      );
    });

    it("reads the limits from admin settings", async () => {
      settings({ max_number_equipment_slots_per_day: "2" });

      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-16T18:00:00.000Z", 3))).rejects.toThrow(
        "You can only select up to 1 hours (2 slots) per day."
      );
    });

    it("buckets days on the business clock, so 23:30 Monday and 00:00 Tuesday NWT are different days", async () => {
      // Mon 21:30-23:30 NWT: four slots. In UTC they are Tuesday 03:30-05:30.
      db.equipmentBooking.findMany.mockResolvedValue(existing(run("2026-11-17T03:30:00.000Z", 4)));

      // Tue 00:00 NWT = Tue 06:00 UTC, the same UTC day as the four above.
      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-17T06:00:00.000Z", 1))).resolves.toBeUndefined();
    });

    it("refuses a 7-day period that would go over the weekly limit", async () => {
      settings({ max_number_equipment_slots_per_day: "48" });
      db.equipmentBooking.findMany.mockResolvedValue(existing(run("2026-11-17T16:00:00.000Z", 13)));

      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-19T16:00:00.000Z", 2))).rejects.toThrow(
        "You can only select up to 7 hours (14 slots) within any 7-day period."
      );
    });

    it("slides the 7-day period like the grid, so bookings a week apart do not add up", async () => {
      settings({ equipment_visible_registrable_days: "14" });
      // Four a day on Mon, Tue and Wed: 12 slots.
      db.equipmentBooking.findMany.mockResolvedValue(
        existing([
          ...run("2026-11-16T16:00:00.000Z", 4),
          ...run("2026-11-17T16:00:00.000Z", 4),
          ...run("2026-11-18T16:00:00.000Z", 4),
        ])
      );

      // Three on the following Monday: no 7-day period holds more than 4 + 4 + 3.
      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-23T16:00:00.000Z", 3))).resolves.toBeUndefined();
      // Three on Sunday the 22nd land in the period starting Mon 16: 12 + 3 = 15.
      await expect(assertEquipmentSlotLimits(6, 1, run("2026-11-22T16:00:00.000Z", 3))).rejects.toThrow(
        "within any 7-day period"
      );
    });
  });

  describe("createEquipmentCheckout", () => {
    it("holds the slots and the pre-GST amount on the server for this member", async () => {
      db.equipmentCheckout.create.mockResolvedValue({ id: "chk_1" });
      const slots = [{ startTime: "2026-11-16T18:00:00.000Z", endTime: "2026-11-16T18:30:00.000Z" }];

      const checkout = await createEquipmentCheckout(6, 1, slots, 20);

      expect(checkout).toEqual({ id: "chk_1" });
      expect(db.equipmentCheckout.create).toHaveBeenCalledWith({
        data: { userId: 6, equipmentId: 1, slots, amount: 20 },
      });
    });
  });

  describe("fulfilEquipmentCheckout", () => {
    const HELD = [
      { startTime: "2026-11-16T18:00:00.000Z", endTime: "2026-11-16T18:30:00.000Z" },
      { startTime: "2026-11-16T18:30:00.000Z", endTime: "2026-11-16T19:00:00.000Z" },
    ];

    beforeEach(() => {
      db.equipmentCheckout.findUnique.mockResolvedValue({
        id: "chk_1",
        userId: 6,
        equipmentId: 1,
        slots: HELD,
        amount: 40,
        fulfilledAt: null,
      });
      db.equipmentSlot.create.mockImplementation(async ({ data }: any) => ({ id: 50, isBooked: false, ...data }));
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 70 });
      db.equipmentCheckout.update.mockResolvedValue({});
    });

    it("books exactly the held slots for the member with the payment id, then marks the checkout fulfilled", async () => {
      const result = await fulfilEquipmentCheckout("chk_1", 6, "pi_9");

      expect(result).toEqual({ count: 2, alreadyFulfilled: false, equipmentId: 1 });
      expect(db.equipmentBooking.create).toHaveBeenCalledTimes(2);
      expect(db.equipmentBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 6, equipmentId: 1, paymentIntentId: "pi_9" }),
      });
      expect(db.equipmentSlot.create.mock.calls.map((c: any) => c[0].data.startTime)).toEqual([
        new Date(HELD[0].startTime),
        new Date(HELD[1].startTime),
      ]);
      expect(db.equipmentCheckout.update).toHaveBeenCalledWith({
        where: { id: "chk_1" },
        data: { fulfilledAt: expect.any(Date) },
      });
    });

    it("refuses another member's checkout and books nothing", async () => {
      await expect(fulfilEquipmentCheckout("chk_1", 99, "pi_9")).rejects.toThrow(
        "This booking belongs to a different account."
      );
      expect(db.equipmentBooking.create).not.toHaveBeenCalled();
    });

    it("does not book a fulfilled checkout twice", async () => {
      db.equipmentCheckout.findUnique.mockResolvedValue({
        id: "chk_1",
        userId: 6,
        equipmentId: 1,
        slots: HELD,
        amount: 40,
        fulfilledAt: new Date(),
      });

      const result = await fulfilEquipmentCheckout("chk_1", 6, "pi_9");

      expect(result).toEqual({ count: 0, alreadyFulfilled: true, equipmentId: 1 });
      expect(db.equipmentBooking.create).not.toHaveBeenCalled();
    });

    it("throws for an unknown checkout", async () => {
      db.equipmentCheckout.findUnique.mockResolvedValue(null);

      await expect(fulfilEquipmentCheckout("nope", 6, "pi_9")).rejects.toThrow("Booking details not found.");
    });
  });

  describe("bookEquipmentBulkByTimes: the final booking re-checks", () => {
    const TIMES = [
      { startTime: "2026-11-16T18:00:00.000Z", endTime: "2026-11-16T18:30:00.000Z" },
      { startTime: "2026-11-16T18:30:00.000Z", endTime: "2026-11-16T19:00:00.000Z" },
    ];

    beforeEach(() => {
      db.equipmentSlot.create.mockImplementation(async ({ data }: any) => ({ id: 50, isBooked: false, ...data }));
      db.equipmentBooking.findFirst.mockResolvedValue(null);
      db.equipmentBooking.create.mockResolvedValue({ id: 70 });
    });

    it("enforces the daily limit at booking time too", async () => {
      db.equipmentBooking.findMany.mockResolvedValue(existing(run("2026-11-16T16:00:00.000Z", 3)));

      await expect(bookEquipmentBulkByTimes(6, 1, TIMES, "pi_1")).rejects.toThrow("per day");
      expect(db.equipmentBooking.create).not.toHaveBeenCalled();
    });

    it("refuses before writing anything when another member holds one of the slots", async () => {
      db.equipmentSlot.findFirst.mockImplementation(async ({ where }: any) =>
        where.startTime.getTime() === new Date(TIMES[1].startTime).getTime()
          ? { id: 3, isBooked: true, workshopOccurrenceId: null }
          : null
      );

      await expect(bookEquipmentBulkByTimes(6, 1, TIMES, "pi_1")).rejects.toThrow(
        "That time is already booked or reserved. Please choose another time."
      );
      expect(db.equipmentBooking.create).not.toHaveBeenCalled();
    });

    it("skips a slot this same payment already booked, so a retried fulfilment completes", async () => {
      db.equipmentSlot.findFirst.mockImplementation(async ({ where }: any) =>
        where.startTime.getTime() === new Date(TIMES[0].startTime).getTime()
          ? { id: 3, isBooked: true, workshopOccurrenceId: null }
          : null
      );
      db.equipmentBooking.findFirst.mockImplementation(async ({ where }: any) =>
        where.slotId === 3 && where.paymentIntentId === "pi_1" && where.userId === 6 ? { id: 61 } : null
      );

      const result = await bookEquipmentBulkByTimes(6, 1, TIMES, "pi_1");

      expect(result.count).toBe(1);
      expect(db.equipmentBooking.create).toHaveBeenCalledTimes(1);
    });
  });
});
