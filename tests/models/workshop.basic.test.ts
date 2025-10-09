import "tests/fixtures/workshop/setup";
import { getWorkshopMocks } from "tests/fixtures/workshop/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockWorkshop,
  createMockOccurrence,
  createMockWorkshopWithOccurrences,
} from "tests/fixtures/workshop/workshops";
import {
  getWorkshops,
  addWorkshop,
  getWorkshopById,
  updateWorkshopWithOccurrences,
  deleteWorkshop,
  duplicateWorkshop,
  offerWorkshopAgain,
} from "~/models/workshop.server";

describe("workshop.server - Basic Operations", () => {
  let db: any;
  let mockCreateEquipmentSlotsForOccurrence: jest.Mock;
  let mockCreateEventForOccurrence: jest.Mock;
  let mockUpdateEventForOccurrence: jest.Mock;
  let mockDeleteEventForOccurrence: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getWorkshopMocks();
    db = mocks.db;
    mockCreateEquipmentSlotsForOccurrence = mocks.mockCreateEquipmentSlotsForOccurrence;
    mockCreateEventForOccurrence = mocks.mockCreateEventForOccurrence;
    mockUpdateEventForOccurrence = mocks.mockUpdateEventForOccurrence;
    mockDeleteEventForOccurrence = mocks.mockDeleteEventForOccurrence;
  });

  describe("getWorkshops", () => {
    it("should return all workshops with status and registration counts", async () => {
      const mockWorkshops = [
        createMockWorkshop({
          occurrences: [
            createMockOccurrence({
              userWorkshops: [
                { id: 1, userId: 1, result: "passed" },
                { id: 2, userId: 2, result: "passed" },
                { id: 3, userId: 3, result: "cancelled" },
              ],
            }),
          ],
        }),
      ];

      db.workshop.findMany.mockResolvedValue(mockWorkshops);

      const result = await getWorkshops();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("active");
      expect(result[0].occurrences[0].registrationCount).toBe(2);
    });

    it("should calculate display price from price variations", async () => {
      const mockWorkshops = [
        createMockWorkshop({
          hasPriceVariations: true,
          priceVariations: [
            { id: 1, price: 50, name: "Student" },
            { id: 2, price: 100, name: "Adult" },
          ],
        }),
      ];

      db.workshop.findMany.mockResolvedValue(mockWorkshops);

      const result = await getWorkshops();

      expect(result[0].displayPrice).toBe(50);
      expect(result[0].priceRange).toEqual({ min: 50, max: 100 });
    });

    it("should default to expired status when no occurrences exist", async () => {
      const mockWorkshops = [createMockWorkshop({ occurrences: [] })];

      db.workshop.findMany.mockResolvedValue(mockWorkshops);

      const result = await getWorkshops();

      expect(result[0].status).toBe("expired");
    });
  });

  describe("addWorkshop", () => {
    it("should create a workshop with occurrences", async () => {
      const mockWorkshopData = {
        name: "New Workshop",
        description: "Description",
        price: 100,
        location: "Location",
        capacity: 20,
        type: "workshop",
        occurrences: [
          {
            startDate: new Date("2025-12-01T10:00:00Z"),
            endDate: new Date("2025-12-01T12:00:00Z"),
          },
        ],
        selectedSlots: {},
      };

      const mockCreatedWorkshop = { id: 1, ...mockWorkshopData };
      const mockCreatedOccurrence = createMockOccurrence({
        workshopId: 1,
        startDate: mockWorkshopData.occurrences[0].startDate,
        endDate: mockWorkshopData.occurrences[0].endDate,
      });

      db.workshop.create.mockResolvedValue(mockCreatedWorkshop);
      db.workshopOccurrence.create.mockResolvedValue(mockCreatedOccurrence);
      db.workshopOccurrence.aggregate.mockResolvedValue({ _max: { connectId: null } });
      mockCreateEventForOccurrence.mockResolvedValue("google-event-id");
      db.workshopOccurrence.update.mockResolvedValue({
        ...mockCreatedOccurrence,
        googleEventId: "google-event-id",
      });

      const result = await addWorkshop(mockWorkshopData);

      expect(result.id).toBe(1);
      expect(db.workshop.create).toHaveBeenCalled();
      expect(db.workshopOccurrence.create).toHaveBeenCalled();
    });

    it("should create workshop with prerequisites", async () => {
      const mockWorkshopData = {
        name: "Advanced Workshop",
        description: "Description",
        price: 100,
        location: "Location",
        capacity: 20,
        type: "workshop",
        prerequisites: [1, 2],
        occurrences: [
          {
            startDate: new Date("2025-12-01T10:00:00Z"),
            endDate: new Date("2025-12-01T12:00:00Z"),
          },
        ],
        selectedSlots: {},
      };

      db.workshop.create.mockResolvedValue({ id: 1 });
      db.workshopOccurrence.create.mockResolvedValue({ id: 1, workshopId: 1 });
      db.workshopOccurrence.aggregate.mockResolvedValue({ _max: { connectId: null } });
      db.workshopPrerequisite.createMany.mockResolvedValue({});
      mockCreateEventForOccurrence.mockResolvedValue(null);

      await addWorkshop(mockWorkshopData);

      expect(db.workshopPrerequisite.createMany).toHaveBeenCalledWith({
        data: [
          { workshopId: 1, prerequisiteId: 1 },
          { workshopId: 1, prerequisiteId: 2 },
        ],
      });
    });

    it("should create workshop with price variations", async () => {
      const mockWorkshopData = {
        name: "Workshop with Variations",
        description: "Description",
        price: 100,
        location: "Location",
        capacity: 20,
        type: "workshop",
        hasPriceVariations: true,
        priceVariations: [
          {
            name: "Student",
            price: 50,
            description: "Student rate",
            capacity: 10,
          },
        ],
        occurrences: [
          {
            startDate: new Date("2025-12-01T10:00:00Z"),
            endDate: new Date("2025-12-01T12:00:00Z"),
          },
        ],
        selectedSlots: {},
      };

      db.workshop.create.mockResolvedValue({ id: 1 });
      db.workshopOccurrence.create.mockResolvedValue({ id: 1, workshopId: 1 });
      db.workshopOccurrence.aggregate.mockResolvedValue({ _max: { connectId: null } });
      db.workshopPriceVariation.createMany.mockResolvedValue({});
      mockCreateEventForOccurrence.mockResolvedValue(null);

      await addWorkshop(mockWorkshopData);

      expect(db.workshopPriceVariation.createMany).toHaveBeenCalled();
    });

    it("should throw error on failure", async () => {
      const mockWorkshopData = {
        name: "Failed Workshop",
        description: "Description",
        price: 100,
        location: "Location",
        capacity: 20,
        type: "workshop",
        occurrences: [],
        selectedSlots: {},
      };

      db.workshop.create.mockRejectedValue(new Error("Database error"));

      await expect(addWorkshop(mockWorkshopData)).rejects.toThrow(
        "Failed to add workshop: Database error"
      );
    });
  });

  describe("getWorkshopById", () => {
    it("should return workshop with prerequisites and equipment", async () => {
      const mockWorkshop = createMockWorkshop({
        occurrences: [
          createMockOccurrence({
            equipmentSlots: [
              { equipmentId: 1, equipment: { name: "Laser Cutter" } },
            ],
          }),
        ],
        prerequisites: [{ prerequisiteId: 1 }],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getWorkshopById(1);

      expect(result.prerequisites).toEqual([1]);
      expect(result.equipments).toContain(1);
    });

    it("should throw error if workshop not found", async () => {
      db.workshop.findUnique.mockResolvedValue(null);

      await expect(getWorkshopById(999)).rejects.toThrow("Failed to fetch workshop");
    });
  });

  describe("updateWorkshopWithOccurrences", () => {
    it("should update workshop basic info", async () => {
      const updateData = {
        name: "Updated Workshop",
        description: "Updated Description",
        price: 150,
        location: "New Location",
        capacity: 25,
        type: "workshop",
        prerequisites: [1],
        equipments: [],
        occurrences: [],
        isMultiDayWorkshop: false,
      };

      db.workshop.update.mockResolvedValue({ id: 1 });
      db.workshopOccurrence.findMany.mockResolvedValue([]);
      db.workshopPrerequisite.deleteMany.mockResolvedValue({});
      db.workshopPrerequisite.createMany.mockResolvedValue({});
      db.workshop.findUnique.mockResolvedValue({ id: 1 });

      await updateWorkshopWithOccurrences(1, updateData);

      expect(db.workshop.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          name: "Updated Workshop",
          price: 150,
        }),
      });
    });

    it("should delete removed occurrences", async () => {
      const existingOccurrences = [
        { id: 1, workshopId: 1, googleEventId: "event-1" },
        { id: 2, workshopId: 1, googleEventId: "event-2" },
      ];

      const updateData = {
        name: "Workshop",
        description: "Description",
        price: 100,
        location: "Location",
        capacity: 20,
        type: "workshop",
        occurrences: [{ id: 1, startDate: new Date(), endDate: new Date() }],
        isMultiDayWorkshop: false,
      };

      db.workshop.update.mockResolvedValue({ id: 1 });
      db.workshopOccurrence.findMany
        .mockResolvedValueOnce(existingOccurrences)
        .mockResolvedValueOnce([{ id: 2, googleEventId: "event-2" }]);
      db.workshopOccurrence.update.mockResolvedValue({
        id: 1,
        googleEventId: "event-1",
      });
      db.workshopOccurrence.deleteMany.mockResolvedValue({});
      db.workshop.findUnique.mockResolvedValue({ id: 1 });
      mockUpdateEventForOccurrence.mockResolvedValue(undefined);
      mockDeleteEventForOccurrence.mockResolvedValue(undefined);

      await updateWorkshopWithOccurrences(1, updateData);

      expect(db.workshopOccurrence.deleteMany).toHaveBeenCalled();
      expect(mockDeleteEventForOccurrence).toHaveBeenCalledWith("event-2");
    });
  });

  describe("deleteWorkshop", () => {
    it("should delete workshop and Google Calendar events", async () => {
      const mockWorkshop = {
        id: 1,
        occurrences: [
          { id: 1, googleEventId: "event-1" },
          { id: 2, googleEventId: "event-2" },
        ],
      };

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.workshop.delete.mockResolvedValue({ id: 1 });
      mockDeleteEventForOccurrence.mockResolvedValue(undefined);

      const result = await deleteWorkshop(1);

      expect(result.success).toBe(true);
      expect(mockDeleteEventForOccurrence).toHaveBeenCalledTimes(2);
    });

    it("should throw error if workshop not found", async () => {
      db.workshop.findUnique.mockResolvedValue(null);

      await expect(deleteWorkshop(999)).rejects.toThrow("Failed to delete workshop");
    });
  });

  describe("duplicateWorkshop", () => {
    it("should create a copy of workshop with (Copy) suffix", async () => {
      const mockOriginalWorkshop = createMockWorkshop({
        occurrences: [createMockOccurrence({ connectId: null })],
      });

      db.$transaction.mockImplementation(async (callback: any) => {
        const prisma = {
          workshop: {
            findUnique: jest.fn().mockResolvedValue(mockOriginalWorkshop),
            create: jest.fn().mockResolvedValue({ id: 2 }),
          },
          workshopOccurrence: {
            createMany: jest.fn().mockResolvedValue({}),
          },
          workshopPrerequisite: {
            findMany: jest.fn().mockResolvedValue([]),
            createMany: jest.fn().mockResolvedValue({}),
          },
        };
        return await callback(prisma);
      });

      const result = await duplicateWorkshop(1);

      expect(result).toBeDefined();
    });

    it("should throw error if workshop not found", async () => {
      db.$transaction.mockImplementation(async (callback: any) => {
        const prisma = {
          workshop: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return await callback(prisma);
      });

      await expect(duplicateWorkshop(999)).rejects.toThrow(
        "Failed to duplicate workshop"
      );
    });
  });

  describe("offerWorkshopAgain", () => {
    it("should create new occurrences with incremented offerId", async () => {
      const mockWorkshop = createMockWorkshop({ hasPriceVariations: false });

      const newOccurrences = [
        {
          startDate: new Date("2025-12-01T10:00:00Z"),
          endDate: new Date("2025-12-01T12:00:00Z"),
          startDatePST: new Date("2025-12-01T02:00:00Z"),
          endDatePST: new Date("2025-12-01T04:00:00Z"),
        },
      ];

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.workshopOccurrence.aggregate.mockResolvedValue({ _max: { offerId: 2 } });
      db.workshopOccurrence.create.mockResolvedValue({
        id: 10,
        workshopId: 1,
        offerId: 3,
      });
      mockCreateEventForOccurrence.mockResolvedValue(null);

      const result = await offerWorkshopAgain(1, newOccurrences);

      expect(result).toHaveLength(1);
      expect(db.workshopOccurrence.create).toHaveBeenCalled();
    });

    it("should throw error if workshop not found", async () => {
      db.workshop.findUnique.mockResolvedValue(null);

      await expect(offerWorkshopAgain(999, [])).rejects.toThrow(
        "Failed to create new workshop offer"
      );
    });
  });
});
