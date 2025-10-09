import "tests/fixtures/workshop/setup";
import { getWorkshopMocks } from "tests/fixtures/workshop/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockWorkshop,
  createMockOccurrence,
  createMockUserWorkshop,
  createMockMultiDayWorkshop,
} from "tests/fixtures/workshop/workshops";
import {
  registerForWorkshop,
  checkUserRegistration,
  registerUserForAllOccurrences,
  updateRegistrationResult,
  updateMultipleRegistrations,
  getUserCompletedPrerequisites,
  getUserCompletedOrientations,
} from "~/models/workshop.server";

describe("workshop.server - Registration", () => {
  let db: any;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getWorkshopMocks();
    db = mocks.db;
  });

  describe("registerForWorkshop", () => {
    it("should register user for workshop", async () => {
      const mockOccurrence = createMockOccurrence();
      const mockWorkshop = createMockWorkshop({
        occurrences: [mockOccurrence],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.workshopOccurrence.findFirst.mockResolvedValue(mockOccurrence);
      db.userWorkshop.findFirst.mockResolvedValue(null);
      db.userWorkshop.create.mockResolvedValue(
        createMockUserWorkshop({ userId: 1, workshopId: 1, occurrenceId: 1 })
      );

      const result = await registerForWorkshop(1, 1, 1);

      expect(result.success).toBe(true);
      expect(result.workshopName).toBe("Test Workshop");
      expect(db.userWorkshop.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          workshopId: 1,
          occurrenceId: 1,
          priceVariationId: undefined,
          result: "passed",
        },
      });
    });

    it("should set result to pending for orientation workshops", async () => {
      const mockOccurrence = createMockOccurrence();
      const mockWorkshop = createMockWorkshop({
        type: "orientation",
        name: "Orientation",
        occurrences: [mockOccurrence],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.workshopOccurrence.findFirst.mockResolvedValue(mockOccurrence);
      db.userWorkshop.findFirst.mockResolvedValue(null);
      db.userWorkshop.create.mockResolvedValue({});

      await registerForWorkshop(1, 1, 1);

      expect(db.userWorkshop.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          result: "pending",
        }),
      });
    });

    it("should update existing cancelled registration", async () => {
      const mockOccurrence = createMockOccurrence();
      const mockWorkshop = createMockWorkshop({
        occurrences: [mockOccurrence],
      });
      const existingRegistration = createMockUserWorkshop({ result: "cancelled" });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.workshopOccurrence.findFirst.mockResolvedValue(mockOccurrence);
      db.userWorkshop.findFirst.mockResolvedValue(existingRegistration);
      db.userWorkshop.update.mockResolvedValue({});

      await registerForWorkshop(1, 1, 1);

      expect(db.userWorkshop.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          result: "passed",
          date: expect.any(Date),
        }),
      });
    });

    it("should throw error when workshop is at capacity", async () => {
      const mockWorkshop = createMockWorkshop({
        capacity: 10,
        occurrences: [
          createMockOccurrence({
            userWorkshops: new Array(10).fill({ result: "passed" }),
          }),
        ],
      });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.workshopOccurrence.findFirst.mockResolvedValue({ id: 1 });

      await expect(registerForWorkshop(1, 1, 1)).rejects.toThrow(
        "Workshop is full"
      );
    });
  });

  describe("checkUserRegistration", () => {
    it("should return registration status", async () => {
      const mockRegistration = createMockUserWorkshop({ result: "passed" });

      db.userWorkshop.findFirst.mockResolvedValue(mockRegistration);

      const result = await checkUserRegistration(1, 1, 1);

      expect(result.registered).toBe(true);
      expect(result.status).toBe("passed");
    });

    it("should return cancelled status for cancelled registrations", async () => {
      const mockRegistration = createMockUserWorkshop({ result: "cancelled" });

      db.userWorkshop.findFirst.mockResolvedValue(mockRegistration);

      const result = await checkUserRegistration(1, 1, 1);

      expect(result.registered).toBe(true);
      expect(result.status).toBe("cancelled");
    });

    it("should return false when user is not registered", async () => {
      db.userWorkshop.findFirst.mockResolvedValue(null);

      const result = await checkUserRegistration(1, 1, 1);

      expect(result.registered).toBe(false);
      expect(result.registeredAt).toBeNull();
    });
  });

  describe("registerUserForAllOccurrences", () => {
    it("should register user for all occurrences in multi-day workshop", async () => {
      const mockOccurrences = [
        createMockOccurrence({ id: 1 }),
        createMockOccurrence({ id: 2 }),
      ];
      const mockWorkshop = createMockMultiDayWorkshop(2, 1);

      db.workshopOccurrence.findMany.mockResolvedValue(mockOccurrences);
      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.userWorkshop.findFirst.mockResolvedValue(null);
      db.userWorkshop.create.mockResolvedValue({});

      const result = await registerUserForAllOccurrences(1, 1, 1);

      expect(result.success).toBe(true);
      expect(db.userWorkshop.create).toHaveBeenCalledTimes(2);
    });

    it("should throw error when no occurrences found", async () => {
      db.workshopOccurrence.findMany.mockResolvedValue([]);

      await expect(registerUserForAllOccurrences(1, 1, 1)).rejects.toThrow(
        "No occurrences found for this workshop"
      );
    });

    it("should skip already registered occurrences", async () => {
      const mockOccurrences = [
        createMockOccurrence({ id: 1 }),
        createMockOccurrence({ id: 2 }),
      ];
      const mockWorkshop = createMockMultiDayWorkshop(2, 1);

      db.workshopOccurrence.findMany.mockResolvedValue(mockOccurrences);
      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.userWorkshop.findFirst
        .mockResolvedValueOnce({ result: "passed" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      db.userWorkshop.create.mockResolvedValue({});

      const result = await registerUserForAllOccurrences(1, 1, 1);

      expect(result.success).toBe(true);
      expect(db.userWorkshop.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateRegistrationResult", () => {
    it("should update registration result and upgrade user roleLevel for passed orientation", async () => {
      const mockRegistration = {
        id: 1,
        workshop: { type: "orientation" },
        user: { id: 1, roleLevel: 1 },
      };
      const mockMembership = { userId: 1 };

      db.userWorkshop.update.mockResolvedValue(mockRegistration);
      db.userMembership.findFirst.mockResolvedValue(mockMembership);
      db.user.update.mockResolvedValue({});

      await updateRegistrationResult(1, "passed");

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { roleLevel: 3 },
      });
    });

    it("should set user to roleLevel 2 for passed orientation without membership", async () => {
      const mockRegistration = {
        id: 1,
        workshop: { type: "orientation" },
        user: { id: 1, roleLevel: 1 },
      };

      db.userWorkshop.update.mockResolvedValue(mockRegistration);
      db.userMembership.findFirst.mockResolvedValue(null);
      db.user.update.mockResolvedValue({});

      await updateRegistrationResult(1, "passed");

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { roleLevel: 2 },
      });
    });

    it("should downgrade user roleLevel when orientation result is not passed", async () => {
      const mockRegistration = {
        id: 1,
        workshop: { type: "orientation" },
        user: { id: 1, roleLevel: 3 },
      };

      db.userWorkshop.update.mockResolvedValue(mockRegistration);
      db.userWorkshop.count.mockResolvedValue(0);
      db.user.update.mockResolvedValue({});

      await updateRegistrationResult(1, "failed");

      expect(db.userWorkshop.count).toHaveBeenCalled();
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { roleLevel: 1 },
      });
    });

    it("should not change roleLevel for non-orientation workshops", async () => {
      const mockRegistration = {
        id: 1,
        workshop: { type: "workshop" },
        user: { id: 1, roleLevel: 3 },
      };

      db.userWorkshop.update.mockResolvedValue(mockRegistration);

      await updateRegistrationResult(1, "passed");

      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  describe("updateMultipleRegistrations", () => {
    it("should update multiple registrations and adjust role levels", async () => {
      const mockRegistrations = [
        {
          id: 1,
          userId: 1,
          user: { id: 1, roleLevel: 1 },
          workshop: { type: "orientation" },
        },
      ];

      db.userWorkshop.updateMany.mockResolvedValue({ count: 1 });
      db.userWorkshop.findMany.mockResolvedValue(mockRegistrations);
      db.userWorkshop.count.mockResolvedValue(1);
      db.userMembership.findFirst.mockResolvedValue(null);
      db.user.update.mockResolvedValue({});

      await updateMultipleRegistrations([1], "passed");

      expect(db.userWorkshop.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: { result: "passed" },
      });
      expect(db.user.update).toHaveBeenCalled();
    });
  });

  describe("getUserCompletedPrerequisites", () => {
    it("should return completed prerequisite workshop IDs", async () => {
      const mockWorkshop = createMockWorkshop({
        prerequisites: [{ prerequisiteId: 2 }, { prerequisiteId: 3 }],
      });
      const mockCompletedWorkshops = [{ workshopId: 2 }, { workshopId: 3 }];

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);
      db.userWorkshop.findMany.mockResolvedValue(mockCompletedWorkshops);

      const result = await getUserCompletedPrerequisites(1, 1);

      expect(result).toEqual([2, 3]);
    });

    it("should return empty array if no prerequisites", async () => {
      const mockWorkshop = createMockWorkshop({ prerequisites: [] });

      db.workshop.findUnique.mockResolvedValue(mockWorkshop);

      const result = await getUserCompletedPrerequisites(1, 1);

      expect(result).toEqual([]);
    });

    it("should return empty array if userId is null", async () => {
      const result = await getUserCompletedPrerequisites(0, 1);

      expect(result).toEqual([]);
    });
  });

  describe("getUserCompletedOrientations", () => {
    it("should return user's completed orientations", async () => {
      const mockOrientations = [
        {
          id: 1,
          userId: 1,
          result: "passed",
          workshop: createMockWorkshop({
            name: "Orientation",
            type: "orientation",
            price: 0,
          }),
          occurrence: createMockOccurrence(),
          priceVariation: null,
        },
      ];

      db.userWorkshop.findMany.mockResolvedValue(mockOrientations);

      const result = await getUserCompletedOrientations(1);

      expect(result).toHaveLength(1);
      expect(result[0].workshop.type).toBe("orientation");
      expect(result[0].result).toBe("passed");
    });
  });
});
