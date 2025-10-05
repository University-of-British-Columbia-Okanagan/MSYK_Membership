import "tests/fixtures/workshop/setup";
import { getWorkshopMocks } from "tests/fixtures/workshop/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockOccurrence,
  createMockUserWorkshop,
} from "tests/fixtures/workshop/workshops";
import {
  cancelUserWorkshopRegistration,
  cancelMultiDayWorkshopRegistration,
  cancelWorkshopOccurrence,
  cancelWorkshopPriceVariation,
  getAllWorkshopCancellations,
  updateWorkshopCancellationResolved,
  createWorkshopCancellation,
  getWorkshopCancellationsByStatus,
  getWorkshopOccurrencesByConnectId,
} from "~/models/workshop.server";

describe("workshop.server - Cancellation", () => {
  let db: any;
  let mockDeleteEventForOccurrence: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getWorkshopMocks();
    db = mocks.db;
    mockDeleteEventForOccurrence = mocks.mockDeleteEventForOccurrence;
  });

  describe("cancelUserWorkshopRegistration", () => {
    it("should cancel registration and create cancellation record", async () => {
      const mockRegistration = createMockUserWorkshop({
        paymentIntentId: "pi_123",
        result: "passed",
      });

      db.userWorkshop.findFirst.mockResolvedValue(mockRegistration);
      db.userWorkshop.updateMany.mockResolvedValue({ count: 1 });
      db.workshopCancelledRegistration.create.mockResolvedValue({});

      await cancelUserWorkshopRegistration({
        workshopId: 1,
        occurrenceId: 1,
        userId: 1,
      });

      expect(db.userWorkshop.updateMany).toHaveBeenCalledWith({
        where: { workshopId: 1, occurrenceId: 1, userId: 1 },
        data: { result: "cancelled" },
      });
      expect(db.workshopCancelledRegistration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          workshopId: 1,
          workshopOccurrenceId: 1,
          paymentIntentId: "pi_123",
        }),
      });
    });

    it("should throw error if no active registration found", async () => {
      db.userWorkshop.findFirst.mockResolvedValue(null);

      await expect(
        cancelUserWorkshopRegistration({
          workshopId: 1,
          occurrenceId: 1,
          userId: 1,
        })
      ).rejects.toThrow("No active registration found to cancel");
    });
  });

  describe("cancelMultiDayWorkshopRegistration", () => {
    it("should cancel all occurrences in multi-day workshop", async () => {
      const mockOccurrences = [
        createMockOccurrence({ id: 1 }),
        createMockOccurrence({ id: 2 }),
      ];

      const mockRegistrations = [
        createMockUserWorkshop({ id: 1, occurrenceId: 1 }),
        createMockUserWorkshop({ id: 2, occurrenceId: 2 }),
      ];

      db.workshopOccurrence.findMany.mockResolvedValue(mockOccurrences);
      db.userWorkshop.findMany.mockResolvedValue(mockRegistrations);
      db.userWorkshop.updateMany.mockResolvedValue({ count: 2 });
      db.workshopCancelledRegistration.create.mockResolvedValue({});

      await cancelMultiDayWorkshopRegistration({
        workshopId: 1,
        connectId: 1,
        userId: 1,
      });

      expect(db.userWorkshop.updateMany).toHaveBeenCalledWith({
        where: {
          workshopId: 1,
          userId: 1,
          occurrenceId: { in: [1, 2] },
        },
        data: { result: "cancelled" },
      });
      expect(db.workshopCancelledRegistration.create).toHaveBeenCalledTimes(1);
    });

    it("should throw error if no occurrences found", async () => {
      db.workshopOccurrence.findMany.mockResolvedValue([]);

      await expect(
        cancelMultiDayWorkshopRegistration({
          workshopId: 1,
          connectId: 1,
          userId: 1,
        })
      ).rejects.toThrow("No occurrences found for this multi-day workshop");
    });

    it("should throw error if no active registrations found", async () => {
      const mockOccurrences = [
        createMockOccurrence({ id: 1 }),
        createMockOccurrence({ id: 2 }),
      ];

      db.workshopOccurrence.findMany.mockResolvedValue(mockOccurrences);
      db.userWorkshop.findMany.mockResolvedValue([]);

      await expect(
        cancelMultiDayWorkshopRegistration({
          workshopId: 1,
          connectId: 1,
          userId: 1,
        })
      ).rejects.toThrow("No active registrations found to cancel");
    });
  });

  describe("cancelWorkshopOccurrence", () => {
    it("should cancel occurrence and delete Google Calendar event", async () => {
      const mockOccurrence = createMockOccurrence({ googleEventId: "event-1" });

      db.workshopOccurrence.findUnique.mockResolvedValue(mockOccurrence);
      db.workshopOccurrence.update.mockResolvedValue({
        id: 1,
        status: "cancelled",
      });
      mockDeleteEventForOccurrence.mockResolvedValue(undefined);

      const result = await cancelWorkshopOccurrence(1);

      expect(result.status).toBe("cancelled");
      expect(mockDeleteEventForOccurrence).toHaveBeenCalledWith("event-1");
      expect(db.workshopOccurrence.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: "cancelled",
          googleEventId: null,
        },
      });
    });

    it("should throw error if occurrence not found", async () => {
      db.workshopOccurrence.findUnique.mockResolvedValue(null);

      await expect(cancelWorkshopOccurrence(999)).rejects.toThrow(
        "Workshop occurrence not found"
      );
    });

    it("should continue cancellation even if Google Calendar deletion fails", async () => {
      const mockOccurrence = createMockOccurrence({ googleEventId: "event-1" });

      db.workshopOccurrence.findUnique.mockResolvedValue(mockOccurrence);
      db.workshopOccurrence.update.mockResolvedValue({
        id: 1,
        status: "cancelled",
      });
      mockDeleteEventForOccurrence.mockRejectedValue(
        new Error("Google Calendar error")
      );

      const result = await cancelWorkshopOccurrence(1);

      expect(result.status).toBe("cancelled");
      expect(db.workshopOccurrence.update).toHaveBeenCalled();
    });
  });

  describe("cancelWorkshopPriceVariation", () => {
    it("should cancel price variation and related registrations", async () => {
      db.workshopPriceVariation.update.mockResolvedValue({});
      db.userWorkshop.updateMany.mockResolvedValue({});

      const result = await cancelWorkshopPriceVariation(1);

      expect(result.success).toBe(true);
      expect(db.workshopPriceVariation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "cancelled" },
      });
      expect(db.userWorkshop.updateMany).toHaveBeenCalledWith({
        where: { priceVariationId: 1 },
        data: { result: "cancelled" },
      });
    });
  });

  describe("getAllWorkshopCancellations", () => {
    it("should return all workshop cancellations with details", async () => {
      const mockCancellations = [
        {
          id: 1,
          userId: 1,
          workshopId: 1,
          workshopOccurrenceId: 1,
          cancellationDate: new Date(),
          paymentIntentId: "pi_123",
          user: {
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          workshop: { id: 1, name: "Workshop", type: "workshop" },
          workshopOccurrence: {
            id: 1,
            startDate: new Date(),
            endDate: new Date(),
            connectId: null,
          },
          priceVariation: { id: 1, name: "Student", price: 50 },
        },
      ];

      db.workshopCancelledRegistration.findMany.mockResolvedValue(
        mockCancellations
      );

      const result = await getAllWorkshopCancellations();

      expect(result).toHaveLength(1);
      expect(result[0].stripePaymentIntentId).toBe("pi_123");
      expect(result[0].user.firstName).toBe("John");
    });
  });

  describe("updateWorkshopCancellationResolved", () => {
    it("should update cancellation resolved status", async () => {
      db.workshopCancelledRegistration.update.mockResolvedValue({
        id: 1,
        resolved: true,
      });

      const result = await updateWorkshopCancellationResolved(1, true);

      expect(db.workshopCancelledRegistration.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { resolved: true },
      });
      expect(result.resolved).toBe(true);
    });
  });

  describe("createWorkshopCancellation", () => {
    it("should create a workshop cancellation record", async () => {
      const cancellationData = {
        userId: 1,
        workshopId: 1,
        workshopOccurrenceId: 1,
        priceVariationId: null,
        registrationDate: new Date("2025-01-01"),
        cancellationDate: new Date("2025-01-15"),
        paymentIntentId: "pi_123",
      };

      db.workshopCancelledRegistration.create.mockResolvedValue({
        id: 1,
        ...cancellationData,
      });

      const result = await createWorkshopCancellation(cancellationData);

      expect(db.workshopCancelledRegistration.create).toHaveBeenCalledWith({
        data: cancellationData,
      });
      expect(result.id).toBe(1);
    });
  });

  describe("getWorkshopCancellationsByStatus", () => {
    it("should return unresolved cancellations", async () => {
      const mockCancellations = [
        {
          id: 1,
          resolved: false,
          user: { firstName: "John", lastName: "Doe", email: "john@example.com" },
          workshop: { id: 1, name: "Workshop", type: "workshop" },
          workshopOccurrence: {
            id: 1,
            startDate: new Date(),
            endDate: new Date(),
          },
          priceVariation: null,
        },
      ];

      db.workshopCancelledRegistration.findMany.mockResolvedValue(
        mockCancellations
      );

      const result = await getWorkshopCancellationsByStatus(false);

      expect(result).toHaveLength(1);
      expect(result[0].resolved).toBe(false);
      expect(db.workshopCancelledRegistration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resolved: false },
        })
      );
    });

    it("should return resolved cancellations", async () => {
      const mockCancellations = [
        {
          id: 1,
          resolved: true,
          user: { firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
          workshop: { id: 2, name: "Another Workshop", type: "workshop" },
          workshopOccurrence: {
            id: 2,
            startDate: new Date(),
            endDate: new Date(),
          },
          priceVariation: null,
        },
      ];

      db.workshopCancelledRegistration.findMany.mockResolvedValue(
        mockCancellations
      );

      const result = await getWorkshopCancellationsByStatus(true);

      expect(result).toHaveLength(1);
      expect(result[0].resolved).toBe(true);
    });
  });

  describe("getWorkshopOccurrencesByConnectId", () => {
    it("should return all occurrences with same connectId", async () => {
      const mockOccurrences = [
        createMockOccurrence({
          id: 1,
          connectId: 5,
          startDate: new Date("2025-12-01"),
        }),
        createMockOccurrence({
          id: 2,
          connectId: 5,
          startDate: new Date("2025-12-02"),
        }),
      ];

      db.workshopOccurrence.findMany.mockResolvedValue(mockOccurrences);

      const result = await getWorkshopOccurrencesByConnectId(1, 5);

      expect(result).toHaveLength(2);
      expect(db.workshopOccurrence.findMany).toHaveBeenCalledWith({
        where: { workshopId: 1, connectId: 5 },
        orderBy: { startDate: "asc" },
      });
    });

    it("should return empty array if no occurrences match", async () => {
      db.workshopOccurrence.findMany.mockResolvedValue([]);

      const result = await getWorkshopOccurrencesByConnectId(1, 999);

      expect(result).toHaveLength(0);
    });
  });
});
