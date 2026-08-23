import "tests/fixtures/workshop/setup";

import { getWorkshopMocks } from "tests/fixtures/workshop/setup";
import type { DbMock } from "tests/helpers/db.mock";
import { clearAllMocks } from "tests/helpers/test-utils";
import { moveUserWorkshopRegistration } from "~/models/workshop.server";

const sourceRegistration = (overrides?: Record<string, unknown>) => ({
  id: 100,
  userId: 1,
  workshopId: 2,
  occurrenceId: 10,
  priceVariationId: null,
  paymentIntentId: "pi_abc",
  result: "pending",
  priceVariation: null,
  ...overrides,
});

/**
 * Shapes the workshop the way checkWorkshopCapacity's include returns it: the
 * matching occurrence nested under `occurrences`, with its non-cancelled
 * registrations nested under `userWorkshops`.
 */
const workshopWithCapacity = (opts?: {
  capacity?: number;
  priceVariations?: Array<Record<string, unknown>>;
  registrations?: Array<Record<string, unknown>>;
}) => ({
  id: 2,
  capacity: opts?.capacity ?? 10,
  priceVariations: opts?.priceVariations ?? [],
  occurrences: [
    {
      id: 20,
      userWorkshops: opts?.registrations ?? [],
    },
  ],
});

const targetOccurrence = (overrides?: Record<string, unknown>) => ({
  id: 20,
  workshopId: 2,
  status: "active",
  connectId: null,
  ...overrides,
});

describe("workshop.server - moveUserWorkshopRegistration", () => {
  let db: DbMock;

  const move = (overrides?: Partial<Record<string, number>>) =>
    moveUserWorkshopRegistration({
      userId: 1,
      workshopId: 2,
      fromOccurrenceId: 10,
      toOccurrenceId: 20,
      ...overrides,
    } as any);

  /** Wires up the happy path; individual tests override the piece they exercise. */
  const arrangeValidMove = () => {
    db.userWorkshop.findFirst
      .mockResolvedValueOnce(sourceRegistration()) // source lookup
      .mockResolvedValueOnce(null); // no existing target registration
    db.workshopOccurrence.findFirst.mockResolvedValue(targetOccurrence());
    // checkWorkshopCapacity loads the workshop together with the target occurrence
    // and that occurrence's non-cancelled registrations, then counts them.
    db.workshop.findUnique.mockResolvedValue(
      workshopWithCapacity({ registrations: [{ id: 1, priceVariationId: null }] })
    );
    db.$transaction.mockImplementation(async (fn: any) =>
      fn({
        userWorkshop: {
          delete: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
      })
    );
  };

  beforeEach(() => {
    clearAllMocks();
    db = getWorkshopMocks().db;
  });

  describe("guards", () => {
    it("rejects a move to the same occurrence", async () => {
      await expect(move({ toOccurrenceId: 10 })).rejects.toThrow(
        "Source and target occurrence must be different"
      );
      expect(db.userWorkshop.findFirst).not.toHaveBeenCalled();
    });

    it("rejects when the user has no active registration on the source", async () => {
      db.userWorkshop.findFirst.mockResolvedValueOnce(null);

      await expect(move()).rejects.toThrow(
        "No active registration found for the source occurrence"
      );
    });

    it("ignores cancelled registrations when finding the source", async () => {
      db.userWorkshop.findFirst.mockResolvedValueOnce(null);

      await expect(move()).rejects.toThrow();

      expect(db.userWorkshop.findFirst.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          userId: 1,
          workshopId: 2,
          occurrenceId: 10,
          result: { not: "cancelled" },
        })
      );
    });

    it("rejects a target that belongs to a different workshop", async () => {
      db.userWorkshop.findFirst.mockResolvedValueOnce(sourceRegistration());
      db.workshopOccurrence.findFirst.mockResolvedValue(null);

      await expect(move()).rejects.toThrow(
        "Target occurrence not found for this workshop"
      );
    });

    it.each([["past"], ["cancelled"]])(
      "rejects a target whose status is %s",
      async (status) => {
        db.userWorkshop.findFirst.mockResolvedValueOnce(sourceRegistration());
        db.workshopOccurrence.findFirst.mockResolvedValue(
          targetOccurrence({ status })
        );

        await expect(move()).rejects.toThrow(
          "Target occurrence is not available"
        );
      }
    );

    it("rejects a multi-day target", async () => {
      db.userWorkshop.findFirst.mockResolvedValueOnce(sourceRegistration());
      db.workshopOccurrence.findFirst.mockResolvedValue(
        targetOccurrence({ connectId: 5 })
      );

      await expect(move()).rejects.toThrow(
        "Cannot move to a multi-day occurrence"
      );
    });

    it("rejects when the user already holds an active registration on the target", async () => {
      db.userWorkshop.findFirst
        .mockResolvedValueOnce(sourceRegistration())
        .mockResolvedValueOnce({ id: 200, result: "passed" });
      db.workshopOccurrence.findFirst.mockResolvedValue(targetOccurrence());

      await expect(move()).rejects.toThrow(
        "User is already registered for the target occurrence"
      );
    });
  });

  describe("successful move", () => {
    it("repoints the existing registration rather than creating a new one", async () => {
      arrangeValidMove();
      const txUpdate = jest.fn().mockResolvedValue({});
      const txDelete = jest.fn().mockResolvedValue({});
      db.$transaction.mockImplementation(async (fn: any) =>
        fn({ userWorkshop: { delete: txDelete, update: txUpdate } })
      );

      await move();

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { occurrenceId: 20 },
      });
      expect(txDelete).not.toHaveBeenCalled();
    });

    it("returns the source price variation so the email shows the right price", async () => {
      db.userWorkshop.findFirst
        .mockResolvedValueOnce(
          sourceRegistration({
            priceVariationId: 5,
            priceVariation: {
              name: "Student",
              description: "Student rate",
              price: 50,
            },
          })
        )
        .mockResolvedValueOnce(null);
      db.workshopOccurrence.findFirst.mockResolvedValue(targetOccurrence());
      db.workshop.findUnique.mockResolvedValue(
        workshopWithCapacity({
          priceVariations: [{ id: 5, name: "Student", capacity: 10 }],
          registrations: [{ id: 1, priceVariationId: 5 }],
        })
      );
      db.$transaction.mockImplementation(async (fn: any) =>
        fn({
          userWorkshop: {
            delete: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
          },
        })
      );

      const result = await move();

      expect(result).toEqual(
        expect.objectContaining({
          fromOccurrenceId: 10,
          toOccurrenceId: 20,
          priceVariationId: 5,
          paymentIntentId: "pi_abc",
          priceVariation: {
            name: "Student",
            description: "Student rate",
            price: 50,
          },
        })
      );
    });

    it("returns a null price variation for a base-price registration", async () => {
      arrangeValidMove();

      const result = await move();

      expect(result.priceVariation).toBeNull();
      expect(result.priceVariationId).toBeNull();
    });

    it("clears a stale cancelled row on the target inside the same transaction", async () => {
      // UserWorkshop is unique on (userId, occurrenceId), so a prior cancelled
      // record on the target would collide with the move.
      db.userWorkshop.findFirst
        .mockResolvedValueOnce(sourceRegistration())
        .mockResolvedValueOnce({ id: 200, result: "cancelled" });
      db.workshopOccurrence.findFirst.mockResolvedValue(targetOccurrence());
      db.workshop.findUnique.mockResolvedValue(workshopWithCapacity());

      const txDelete = jest.fn().mockResolvedValue({});
      const txUpdate = jest.fn().mockResolvedValue({});
      db.$transaction.mockImplementation(async (fn: any) =>
        fn({ userWorkshop: { delete: txDelete, update: txUpdate } })
      );

      await move();

      expect(txDelete).toHaveBeenCalledWith({ where: { id: 200 } });
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { occurrenceId: 20 },
      });
    });

    it("performs the delete and the update atomically", async () => {
      arrangeValidMove();

      await move();

      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
