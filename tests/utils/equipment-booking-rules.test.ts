import {
  formatHour,
  getEquipmentBookingViolation,
  isInPlannedClosure,
  isLevel4RestrictedHour,
} from "~/utils/equipment-booking-rules";

const WEEKDAYS_9_TO_5 = Object.fromEntries(
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => [
    d,
    { start: 9, end: 17, closed: d === "Sunday" },
  ])
);
// 2026-11-16 is a Monday. Times are NWT (UTC-6).
const at = (iso: string) => new Date(iso);
const MON_0930 = at("2026-11-16T15:30:00Z");
const MON_1730 = at("2026-11-16T23:30:00Z");
const MON_2300 = at("2026-11-17T05:00:00Z");
const MON_0500 = at("2026-11-16T11:00:00Z");
const SUN_1000 = at("2026-11-15T16:00:00Z");

describe("equipment booking rules", () => {
  describe("formatHour", () => {
    it("writes 12-hour times, never '17 PM'", () => {
      expect([0, 9, 12, 17, 23].map(formatHour)).toEqual(["12 AM", "9 AM", "12 PM", "5 PM", "11 PM"]);
    });
  });

  describe("level 4 restricted hours", () => {
    it("is off when start and end are both 0", () => {
      expect(isLevel4RestrictedHour(3, { start: 0, end: 0 })).toBe(false);
    });

    it("blocks [start, end) within one day", () => {
      const r = { start: 12, end: 14 };
      expect([11, 12, 13, 14].map((h) => isLevel4RestrictedHour(h, r))).toEqual([false, true, true, false]);
    });

    it("wraps overnight when start is after end", () => {
      const r = { start: 22, end: 6 };
      expect([21, 22, 23, 0, 5, 6].map((h) => isLevel4RestrictedHour(h, r))).toEqual([false, true, true, true, true, false]);
    });
  });

  describe("planned closures", () => {
    const closures = [{ startDate: "2026-11-16T19:00:00.000Z", endDate: "2026-11-16T21:00:00.000Z" }];

    it("includes the start instant and excludes the end instant", () => {
      expect(isInPlannedClosure(at("2026-11-16T18:30:00Z"), closures)).toBe(false);
      expect(isInPlannedClosure(at("2026-11-16T19:00:00Z"), closures)).toBe(true);
      expect(isInPlannedClosure(at("2026-11-16T20:30:00Z"), closures)).toBe(true);
      expect(isInPlannedClosure(at("2026-11-16T21:00:00Z"), closures)).toBe(false);
    });
  });

  describe("getEquipmentBookingViolation", () => {
    const rules = {
      level3Schedule: WEEKDAYS_9_TO_5,
      level4Restrictions: { start: 22, end: 6 },
      plannedClosures: [{ startDate: "2026-11-16T15:00:00.000Z", endDate: "2026-11-16T16:00:00.000Z" }],
    };

    it("allows level 3 inside its hours and outside closures", () => {
      expect(getEquipmentBookingViolation(3, at("2026-11-16T16:30:00Z"), rules)).toBeNull();
    });

    it("rejects level 3 outside its hours, with a readable message", () => {
      expect(getEquipmentBookingViolation(3, MON_1730, rules)).toBe(
        "Level 3 members can only book between 9 AM and 5 PM on Monday. Please contact support."
      );
    });

    it("rejects level 3 on a closed day", () => {
      expect(getEquipmentBookingViolation(3, SUN_1000, rules)).toBe("Level 3 members cannot book equipment on Sunday.");
    });

    it("rejects level 3 during a planned closure", () => {
      expect(getEquipmentBookingViolation(3, MON_0930, rules)).toBe(
        "That time falls in a planned closure. Please choose another time."
      );
    });

    it("rejects level 4 inside the restricted hours, judged on the NWT clock", () => {
      expect(getEquipmentBookingViolation(4, MON_2300, rules)).toBe(
        "Level 4 members cannot book between 10 PM and 6 AM."
      );
      expect(getEquipmentBookingViolation(4, MON_0500, rules)).not.toBeNull();
    });

    it("does not apply closures or level 3 hours to level 4, matching the booking grid", () => {
      expect(getEquipmentBookingViolation(4, MON_0930, rules)).toBeNull();
      expect(getEquipmentBookingViolation(4, MON_1730, rules)).toBeNull();
    });

    it("does not apply level 4 hours to level 3", () => {
      const noClosures = { ...rules, plannedClosures: [] };
      expect(getEquipmentBookingViolation(3, at("2026-11-16T22:00:00Z"), noClosures)).toBeNull();
    });

    it("leaves other levels to the existing permission check", () => {
      expect(getEquipmentBookingViolation(1, MON_2300, rules)).toBeNull();
      expect(getEquipmentBookingViolation(2, MON_2300, rules)).toBeNull();
    });
  });
});
