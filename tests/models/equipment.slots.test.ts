import "tests/fixtures/equipment/setup";

import { getEquipmentMocks } from "tests/fixtures/equipment/setup";
import {
  createMockEquipment,
  createMockSlot,
} from "tests/fixtures/equipment/equipments";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createEquipmentSlot,
  createEquipmentSlotForWorkshop,
  getAvailableSlots,
  bulkBookEquipment,
  setSlotAvailability,
  checkSlotAvailability,
  getAvailableEquipmentSlotsForWorkshopRange,
  getEquipmentSlotsWithStatus,
  getAllEquipmentWithBookings,
} from "~/models/equipment.server";

describe("equipment.server - Slots", () => {
  let db: any;

  beforeEach(() => {
    clearAllMocks();
    db = getEquipmentMocks().db;
  });

  describe("createEquipmentSlot", () => {
    it("creates slot when equipment exists", async () => {
      db.equipment.findUnique.mockResolvedValue({ id: 1 });
      db.equipmentSlot.create.mockResolvedValue({ id: 10 });

      const result = await createEquipmentSlot(1, new Date("2025-01-01T12:00:00Z"));

      expect(result.id).toBe(10);
      expect(db.equipmentSlot.create).toHaveBeenCalled();
    });

    it("throws when equipment missing", async () => {
      db.equipment.findUnique.mockResolvedValue(null);

      await expect(
        createEquipmentSlot(1, new Date("2025-01-01T12:00:00Z"))
      ).rejects.toThrow("Equipment not found.");
    });
  });

  describe("createEquipmentSlotForWorkshop", () => {
    it("assigns slot to workshop when available", async () => {
      db.equipmentSlot.findFirst.mockResolvedValue(null);
      db.equipmentSlot.updateMany.mockResolvedValue({ count: 1 });

      const result = await createEquipmentSlotForWorkshop(
        1,
        new Date("2025-12-01T10:00:00Z"),
        5
      );

      expect(result.count).toBe(1);
      expect(db.equipmentSlot.updateMany).toHaveBeenCalled();
    });

    it("throws when slot already reserved", async () => {
      db.equipmentSlot.findFirst.mockResolvedValue({
        id: 1,
        workshopOccurrenceId: 99,
      });

      await expect(
        createEquipmentSlotForWorkshop(
          1,
          new Date("2025-12-01T10:00:00Z"),
          5
        )
      ).rejects.toThrow("This slot is either booked by a user or already assigned to a workshop.");
    });
  });

  describe("getAvailableSlots", () => {
    it("returns non booked slots", async () => {
      const slots = [createMockSlot({ id: 1 })];
      db.equipmentSlot.findMany.mockResolvedValue(slots);

      const result = await getAvailableSlots(1);

      expect(result).toHaveLength(1);
      expect(db.equipmentSlot.findMany).toHaveBeenCalledWith({
        where: {
          equipmentId: 1,
          isBooked: false,
          workshopOccurrenceId: null,
        },
        orderBy: { startTime: "asc" },
      });
    });
  });

  describe("bulkBookEquipment", () => {
    it("books only available slots", async () => {
      db.equipmentSlot.findMany.mockResolvedValue([
        { id: 2, equipmentId: 1, isBooked: false },
      ]);
      db.equipmentSlot.updateMany.mockResolvedValue({ count: 1 });
      db.equipmentBooking.create.mockResolvedValue({});

      const result = await bulkBookEquipment(1, [2, -1], 10);

      expect(result.count).toBe(1);
      expect(db.equipmentSlot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [2] } },
        data: {
          isBooked: true,
          workshopOccurrenceId: 1,
        },
      });
      expect(db.equipmentBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workshopId: 1,
          slotId: 2,
          userId: 10,
        }),
      });
    });
  });

  describe("setSlotAvailability", () => {
    it("updates slot availability flag", async () => {
      db.equipmentSlot.update.mockResolvedValue({ id: 1, isAvailable: false });

      const result = await setSlotAvailability(1, false);

      expect(result.isAvailable).toBe(false);
      expect(db.equipmentSlot.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isAvailable: false },
      });
    });
  });

  describe("checkSlotAvailability", () => {
    it("returns false when conflicting slot exists", async () => {
      db.equipmentSlot.findFirst.mockResolvedValue({ id: 1 });

      const result = await checkSlotAvailability(1, new Date());

      expect(result).toBe(false);
    });

    it("returns true when no conflict", async () => {
      db.equipmentSlot.findFirst.mockResolvedValue(null);

      const result = await checkSlotAvailability(1, new Date());

      expect(result).toBe(true);
    });
  });

  describe("getAvailableEquipmentSlotsForWorkshopRange", () => {
    it("filters by date and availability", async () => {
      const slots = [createMockSlot({ id: 3, isBooked: false })];
      db.equipmentSlot.findMany.mockResolvedValue(slots);

      const result = await getAvailableEquipmentSlotsForWorkshopRange(
        new Date("2025-12-01T10:00:00Z"),
        new Date("2025-12-02T10:00:00Z")
      );

      expect(result).toHaveLength(1);
      expect(db.equipmentSlot.findMany).toHaveBeenCalledWith({
        where: {
          startTime: { gte: expect.any(Date) },
          endTime: { lte: expect.any(Date) },
          isBooked: false,
          isAvailable: true,
          workshopOccurrenceId: null,
        },
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      });
    });
  });

  describe("getEquipmentSlotsWithStatus", () => {
    it("builds slot grid with booking info", async () => {
      // Use a start time within the visible range (today at 10:00)
      const now = new Date();
      const slotDate = new Date(now);
      slotDate.setHours(10, 0, 0, 0);
      const slot = createMockSlot({
        startTime: slotDate,
        isBooked: true,
        bookings: [
          {
            userId: 1,
            bookedFor: "user",
            user: { firstName: "Bob", lastName: "Smith" },
          },
        ],
      });
      const equipment = createMockEquipment({ slots: [slot] });

      db.equipment.findMany.mockResolvedValue([equipment]);
      db.adminSettings.findUnique.mockResolvedValue({ value: "7" });

      const result = await getEquipmentSlotsWithStatus(1, false);

      expect(result[0].slotsByDay).toBeDefined();
      // find the exact dayKey from the slot's date
      const day = slot.startTime;
      const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
      const dayKey = `${dayName} ${day.getDate()}`;
      expect(result[0].slotsByDay[dayKey]["10:00"]).toEqual(
        expect.objectContaining({
          isBooked: true,
          bookedByMe: true,
          userFirstName: "Bob",
          userLastName: "Smith",
        })
      );
    });
  });

  describe("getAllEquipmentWithBookings", () => {
    it("returns equipment with slot booking info", async () => {
      const equipment = createMockEquipment({ slots: [createMockSlot()] });
      db.equipment.findMany.mockResolvedValue([equipment]);

      const result = await getAllEquipmentWithBookings();

      expect(result).toHaveLength(1);
      expect(db.equipment.findMany).toHaveBeenCalledWith({
        include: {
          slots: {
            include: {
              bookings: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
              workshopOccurrence: {
                select: {
                  workshop: {
                    select: { name: true },
                  },
                },
              },
            },
            orderBy: { startTime: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });
    });
  });
});

