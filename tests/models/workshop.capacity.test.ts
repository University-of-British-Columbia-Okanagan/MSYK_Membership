import "tests/fixtures/workshop/setup";
import { getWorkshopMocks } from "tests/fixtures/workshop/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockWorkshop,
  createMockOccurrence,
  createMockPriceVariation,
} from "tests/fixtures/workshop/workshops";
import {
  checkWorkshopCapacity,
  checkMultiDayWorkshopCapacity,
  getWorkshopRegistrationCounts,
  getMultiDayWorkshopRegistrationCounts,
  getMaxRegistrationCountsPerWorkshopPriceVariation,
} from "~/models/workshop.server";

describe("workshop.server - Capacity Checking", () => {
  let db: any;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getWorkshopMocks();
    db = mocks.db;
  });

  describe("checkWorkshopCapacity", () => {
    it("should return hasCapacity true when workshop has space", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        occurrences: [
          createMockOccurrence({
            userWorkshops: new Array(10).fill({ result: "passed" }),
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkWorkshopCapacity(1, 1);

      expect(result.hasCapacity).toBe(true);
      expect(result.totalRegistrations).toBe(10);
      expect(result.workshopCapacity).toBe(20);
    });

    it("should return hasCapacity false when workshop is full", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 10,
        occurrences: [
          createMockOccurrence({
            userWorkshops: new Array(10).fill({ result: "passed" }),
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkWorkshopCapacity(1, 1);

      expect(result.hasCapacity).toBe(false);
      expect(result.reason).toBe("workshop_full");
    });

    it("should check price variation capacity", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ capacity: 5 })],
        occurrences: [
          createMockOccurrence({
            userWorkshops: [
              { priceVariationId: 1 },
              { priceVariationId: 1 },
              { priceVariationId: 1 },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkWorkshopCapacity(1, 1, 1);

      expect(result.hasCapacity).toBe(true);
      expect(result.variationRegistrations).toBe(3);
      expect(result.variationCapacity).toBe(5);
    });

    it("should return hasCapacity false when price variation is full", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ capacity: 5 })],
        occurrences: [
          createMockOccurrence({
            userWorkshops: new Array(5).fill({ priceVariationId: 1 }),
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkWorkshopCapacity(1, 1, 1);

      expect(result.hasCapacity).toBe(false);
      expect(result.reason).toBe("variation_full");
    });

    it("should throw error if workshop or occurrence not found", async () => {
      db.workshop.findUnique.mockResolvedValue(null);

      await expect(checkWorkshopCapacity(999, 1)).rejects.toThrow(
        "Workshop or occurrence not found"
      );
    });
  });

  describe("checkMultiDayWorkshopCapacity", () => {
    it("should check capacity based on unique users", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        occurrences: [
          createMockOccurrence({
            id: 1,
            userWorkshops: [{ userId: 1 }, { userId: 2 }],
          }),
          createMockOccurrence({
            id: 2,
            userWorkshops: [{ userId: 1 }, { userId: 2 }],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkMultiDayWorkshopCapacity(1, 1);

      expect(result.hasCapacity).toBe(true);
      expect(result.totalRegistrations).toBe(2); // 2 unique users
    });

    it("should return false when multi-day workshop is full", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 2,
        occurrences: [
          createMockOccurrence({
            userWorkshops: [{ userId: 1 }, { userId: 2 }],
          }),
          createMockOccurrence({
            userWorkshops: [{ userId: 1 }, { userId: 2 }],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkMultiDayWorkshopCapacity(1, 1);

      expect(result.hasCapacity).toBe(false);
      expect(result.reason).toBe("workshop_full");
    });

    it("should check variation capacity for multi-day workshop", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ capacity: 5 })],
        occurrences: [
          createMockOccurrence({
            userWorkshops: [
              { userId: 1, priceVariationId: 1 },
              { userId: 2, priceVariationId: 1 },
            ],
          }),
          createMockOccurrence({
            userWorkshops: [
              { userId: 1, priceVariationId: 1 },
              { userId: 2, priceVariationId: 1 },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await checkMultiDayWorkshopCapacity(1, 1, 1);

      expect(result.hasCapacity).toBe(true);
      expect(result.variationRegistrations).toBe(2); // 2 unique users
    });
  });

  describe("getWorkshopRegistrationCounts", () => {
    it("should return registration counts for workshop", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ status: "active" })],
        occurrences: [
          createMockOccurrence({
            userWorkshops: [
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: null, result: "passed" },
              { priceVariationId: 1, result: "cancelled" },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getWorkshopRegistrationCounts(1, 1);

      expect(result.workshopCapacity).toBe(20);
      expect(result.totalRegistrations).toBe(3); // excludes cancelled
      expect(result.baseRegistrations).toBe(1);
      expect(result.variations[0].registrations).toBe(2);
    });

    it("should filter out cancelled variations", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [
          createMockPriceVariation({ id: 1, name: "Student", status: "active" }),
          createMockPriceVariation({ id: 2, name: "Senior", status: "cancelled" }),
        ],
        occurrences: [
          createMockOccurrence({
            userWorkshops: [
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: 2, result: "passed" },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getWorkshopRegistrationCounts(1, 1);

      expect(result.variations).toHaveLength(1);
      expect(result.variations[0].name).toBe("Student");
    });
  });

  describe("getMultiDayWorkshopRegistrationCounts", () => {
    it("should count unique users for multi-day workshop", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ status: "active" })],
        occurrences: [
          createMockOccurrence({
            id: 1,
            userWorkshops: [
              { userId: 1, priceVariationId: 1, result: "passed" },
              { userId: 2, priceVariationId: 1, result: "passed" },
            ],
          }),
          createMockOccurrence({
            id: 2,
            userWorkshops: [
              { userId: 1, priceVariationId: 1, result: "passed" },
              { userId: 2, priceVariationId: 1, result: "passed" },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getMultiDayWorkshopRegistrationCounts(1, 1);

      expect(result.totalRegistrations).toBe(2); // 2 unique users
      expect(result.variations[0].registrations).toBe(2); // 2 unique users for variation
    });
  });

  describe("getMaxRegistrationCountsPerWorkshopPriceVariation", () => {
    it("should return max registrations per occurrence", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ status: "active" })],
        occurrences: [
          createMockOccurrence({
            id: 1,
            userWorkshops: [
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: 1, result: "passed" },
            ],
          }),
          createMockOccurrence({
            id: 2,
            userWorkshops: [
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: 1, result: "passed" },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getMaxRegistrationCountsPerWorkshopPriceVariation(1);

      expect(result.variations[0].registrations).toBe(3);
      expect(result.totalRegistrations).toBe(3);
    });

    it("should exclude cancelled registrations", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 20,
        priceVariations: [createMockPriceVariation({ status: "active" })],
        occurrences: [
          createMockOccurrence({
            userWorkshops: [
              { priceVariationId: 1, result: "passed" },
              { priceVariationId: 1, result: "cancelled" },
            ],
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getMaxRegistrationCountsPerWorkshopPriceVariation(1);

      expect(result.variations[0].registrations).toBe(1); // excludes cancelled
    });
  });
});
