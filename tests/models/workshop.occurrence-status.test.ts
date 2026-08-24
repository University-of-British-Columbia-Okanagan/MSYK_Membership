import "tests/fixtures/workshop/setup";

import { getWorkshopMocks } from "tests/fixtures/workshop/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  updateWorkshopOccurrenceStatuses,
  startWorkshopOccurrenceStatusUpdate,
} from "~/models/workshop.server";

describe("workshop.server - occurrence status background job", () => {
  const now = new Date("2025-06-15T12:00:00Z");

  let db: ReturnType<typeof getWorkshopMocks>["db"];
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  /** The query selects only id and startDate, so the fixture carries only those. */
  const activeOccurrence = (id: number, startDate: string) => ({
    id,
    startDate: new Date(startDate),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    clearAllMocks();
    db = getWorkshopMocks().db;
    db.workshopOccurrence.findMany.mockResolvedValue([]);
    db.workshopOccurrence.updateMany.mockResolvedValue({ count: 0 });
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("updateWorkshopOccurrenceStatuses", () => {
    it("only considers occurrences that are still active", async () => {
      await updateWorkshopOccurrenceStatuses();

      expect(db.workshopOccurrence.findMany).toHaveBeenCalledWith({
        where: { status: "active" },
        select: { id: true, startDate: true },
      });
    });

    it("flips started occurrences to past and reports how many moved", async () => {
      db.workshopOccurrence.findMany.mockResolvedValue([
        activeOccurrence(1, "2025-06-15T10:00:00Z"),
        activeOccurrence(2, "2025-06-14T09:00:00Z"),
      ]);
      db.workshopOccurrence.updateMany.mockResolvedValue({ count: 2 });

      const result = await updateWorkshopOccurrenceStatuses();

      expect(db.workshopOccurrence.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { status: "past" },
      });
      expect(result).toEqual({ updated: 2 });
    });

    it("writes nothing when every active occurrence is still upcoming", async () => {
      db.workshopOccurrence.findMany.mockResolvedValue([
        activeOccurrence(1, "2025-06-15T13:00:00Z"),
        activeOccurrence(2, "2025-07-01T10:00:00Z"),
      ]);

      const result = await updateWorkshopOccurrenceStatuses();

      expect(db.workshopOccurrence.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ updated: 0 });
    });

    it("updates only the started occurrences in a mixed batch", async () => {
      db.workshopOccurrence.findMany.mockResolvedValue([
        activeOccurrence(1, "2025-06-14T10:00:00Z"), // started yesterday
        activeOccurrence(2, "2025-06-15T14:00:00Z"), // starts in two hours
        activeOccurrence(3, "2025-06-15T11:59:59Z"), // started a second ago
      ]);
      db.workshopOccurrence.updateMany.mockResolvedValue({ count: 2 });

      await updateWorkshopOccurrenceStatuses();

      expect(db.workshopOccurrence.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 3] } },
        data: { status: "past" },
      });
    });

    it("leaves an occurrence starting exactly now alone", async () => {
      // The comparison is strictly `startDate < now`, so a workshop starting this
      // instant stays active and is picked up on the next tick.
      db.workshopOccurrence.findMany.mockResolvedValue([
        activeOccurrence(1, "2025-06-15T12:00:00Z"),
      ]);

      const result = await updateWorkshopOccurrenceStatuses();

      expect(db.workshopOccurrence.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ updated: 0 });
    });

    it("rethrows a database failure instead of swallowing it", async () => {
      db.workshopOccurrence.findMany.mockRejectedValue(new Error("db down"));

      await expect(updateWorkshopOccurrenceStatuses()).rejects.toThrow(
        "db down"
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error updating workshop occurrence statuses")
      );
    });
  });

  describe("startWorkshopOccurrenceStatusUpdate", () => {
    it("runs one pass immediately so stale statuses are fixed at boot", () => {
      startWorkshopOccurrenceStatusUpdate();

      expect(db.workshopOccurrence.findMany).toHaveBeenCalledTimes(1);
    });

    it("keeps running once per second", () => {
      startWorkshopOccurrenceStatusUpdate();
      expect(db.workshopOccurrence.findMany).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      expect(db.workshopOccurrence.findMany).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(3000);
      expect(db.workshopOccurrence.findMany).toHaveBeenCalledTimes(5);
    });

    it("schedules on a 1 second interval", () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");

      startWorkshopOccurrenceStatusUpdate();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
      setIntervalSpy.mockRestore();
    });

    it("keeps ticking after a pass that updates nothing", () => {
      db.workshopOccurrence.findMany.mockResolvedValue([
        activeOccurrence(1, "2025-07-01T10:00:00Z"),
      ]);

      startWorkshopOccurrenceStatusUpdate();
      jest.advanceTimersByTime(2000);

      expect(db.workshopOccurrence.findMany).toHaveBeenCalledTimes(3);
      expect(db.workshopOccurrence.updateMany).not.toHaveBeenCalled();
    });
  });
});
