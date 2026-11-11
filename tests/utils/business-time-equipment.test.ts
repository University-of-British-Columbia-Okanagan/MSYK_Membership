import { execFileSync } from "child_process";
import path from "path";
import {
  createEquipmentCellResolver,
  equipmentDayKey,
  equipmentGridDays,
  equipmentTimeKey,
} from "~/utils/business-time-equipment";

// Business (UTC-6) wall clock: Sat Nov 14 2026, 08:00.
const SAT_MORNING = "2026-11-14T14:00:00.000Z";

describe("business-time-equipment", () => {
  describe("grid keys", () => {
    it("keys a 16:00Z slot as the 10:00 cell", () => {
      expect(equipmentDayKey("2026-11-14T16:00:00Z")).toBe("Sat 14");
      expect(equipmentTimeKey("2026-11-14T16:00:00Z")).toBe("10:00");
    });

    it("keeps a late evening slot on its business day, not the UTC day", () => {
      expect(equipmentDayKey("2026-11-15T05:30:00Z")).toBe("Sat 14");
      expect(equipmentTimeKey("2026-11-15T05:30:00Z")).toBe("23:30");
    });

    it("returns an empty key for an invalid date", () => {
      expect(equipmentDayKey("nope")).toBe("");
    });
  });

  describe("equipmentGridDays", () => {
    it("starts on the business today and crosses month ends", () => {
      const days = equipmentGridDays(5, "2026-11-29T03:00:00Z");
      expect(days.map((d) => d.key)).toEqual([
        "Sat 28",
        "Sun 29",
        "Mon 30",
        "Tue 1",
        "Wed 2",
      ]);
      expect(days[0].date.toISOString()).toBe("2026-11-28T06:00:00.000Z");
      expect(days[3].date.toISOString()).toBe("2026-12-01T06:00:00.000Z");
    });
  });

  describe("createEquipmentCellResolver", () => {
    it("turns a cell into its business instant", () => {
      const resolve = createEquipmentCellResolver(7, SAT_MORNING);
      expect(resolve("Sat 14", "10:00").toISOString()).toBe(
        "2026-11-14T16:00:00.000Z"
      );
      expect(resolve("Fri 20", "23:30").toISOString()).toBe(
        "2026-11-21T05:30:00.000Z"
      );
    });

    it("resolves days in the next month without guessing from the day number", () => {
      const resolve = createEquipmentCellResolver(7, "2026-11-28T18:00:00Z");
      expect(resolve("Tue 1", "09:00").toISOString()).toBe(
        "2026-12-01T15:00:00.000Z"
      );
    });

    it("resolves keys outside the visible window to the nearest matching date", () => {
      const resolve = createEquipmentCellResolver(7, SAT_MORNING);
      expect(resolve("Tue 24", "12:00").toISOString()).toBe(
        "2026-11-24T18:00:00.000Z"
      );
      expect(resolve("Mon 9", "12:00").toISOString()).toBe(
        "2026-11-09T18:00:00.000Z"
      );
    });

    it("returns an invalid date for a malformed cell", () => {
      const resolve = createEquipmentCellResolver(7, SAT_MORNING);
      expect(isNaN(resolve("Xyz 99", "10:00").getTime())).toBe(true);
      expect(isNaN(resolve("Sat 14", "").getTime())).toBe(true);
    });
  });

  describe("in a real process per host zone", () => {
    const zones = ["UTC", "America/Vancouver", "America/Yellowknife", "Asia/Tokyo"];
    const results = zones.map((tz) => {
      const out = execFileSync(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        ["tests/helpers/business-time-equipment-snapshot.ts"],
        { env: { ...process.env, TZ: tz }, encoding: "utf8" }
      );
      return JSON.parse(out) as Record<string, unknown>;
    });

    it("runs each host zone with a genuinely different clock", () => {
      expect(new Set(results.map((r) => r.hostHour)).size).toBe(zones.length);
    });

    it("builds the same grid whatever zone the server or device is in", () => {
      const strip = ({ hostHour, ...rest }: Record<string, unknown>) => rest;
      for (const r of results) expect(strip(r)).toEqual(strip(results[0]));
      expect(strip(results[0])).toEqual({
        days: ["Sat 28", "Sun 29", "Mon 30", "Tue 1", "Wed 2", "Thu 3", "Fri 4"],
        slotDay: "Sat 28",
        slotTime: "23:30",
        morning: "2026-11-28T16:00:00.000Z",
        nextMonth: "2026-12-01T15:30:00.000Z",
      });
    });
  });
});
