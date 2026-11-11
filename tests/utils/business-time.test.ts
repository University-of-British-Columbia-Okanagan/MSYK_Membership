import { execFileSync } from "child_process";
import path from "path";
import {
  addBusinessDays,
  addBusinessMonths,
  BUSINESS_TIME_ZONE,
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessTime,
  fromWallClock,
  getWallClock,
  isSameBusinessDay,
  offsetMinutesForWallArray,
  parseBusinessDate,
  parseBusinessDateTime,
  startOfBusinessDay,
  toBusinessDateInput,
  toBusinessDateTimeInput,
  toBusinessIsoString,
  toBusinessTimeInput,
  toWallClockMirror,
  wallArrayForTimestamp,
  withBusinessTime,
} from "~/utils/business-time";

// The November 2026 bug: a 10:30 Woodshop Orientation was stored as 17:30Z
// (10:30 at the stale UTC-7 rule) instead of 16:30Z (10:30 at NWT's UTC-6).
const WOODSHOP_NOV_14 = "2026-11-14T16:30:00.000Z";

// Host zones that disagree with the business clock in different directions,
// including the two whose stale tz data caused the bug.
const HOST_ZONES = [
  "UTC",
  "America/Vancouver",
  "America/Yellowknife",
  "America/Edmonton",
  "America/Toronto",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
];

describe("business-time", () => {
  it("is pinned to a fixed UTC-6 zone, not a DST-observing name", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Etc/GMT+6");
  });

  describe("parsing what an admin types", () => {
    it("reads a typed date and time as NWT wall time", () => {
      expect(parseBusinessDateTime("2026-11-14T10:30").toISOString()).toBe(WOODSHOP_NOV_14);
    });

    it("gives the same instant on both sides of the old Nov 1 clock change", () => {
      expect(parseBusinessDateTime("2026-10-17T10:30").toISOString()).toBe("2026-10-17T16:30:00.000Z");
      expect(parseBusinessDateTime("2026-11-14T10:30").toISOString()).toBe("2026-11-14T16:30:00.000Z");
      expect(parseBusinessDateTime("2027-03-20T10:30").toISOString()).toBe("2027-03-20T16:30:00.000Z");
      expect(parseBusinessDateTime("2027-07-01T10:30").toISOString()).toBe("2027-07-01T16:30:00.000Z");
    });

    it("accepts a space separator and seconds", () => {
      expect(parseBusinessDateTime("2026-11-14 10:30:15").toISOString()).toBe("2026-11-14T16:30:15.000Z");
    });

    it("treats a string with its own offset or Z as a real instant", () => {
      expect(parseBusinessDateTime(WOODSHOP_NOV_14).toISOString()).toBe(WOODSHOP_NOV_14);
      expect(parseBusinessDateTime("2026-11-14T10:30:00-06:00").toISOString()).toBe(WOODSHOP_NOV_14);
    });

    it("parses a bare date as business midnight", () => {
      expect(parseBusinessDate("2026-11-14").toISOString()).toBe("2026-11-14T06:00:00.000Z");
      expect(parseBusinessDateTime("2026-11-14").toISOString()).toBe("2026-11-14T06:00:00.000Z");
    });

    it("returns an invalid Date for empty or junk input instead of throwing", () => {
      for (const bad of ["", null, undefined, "nope", "2026-13-99T99:99x"]) {
        expect(isNaN(parseBusinessDateTime(bad as string).getTime())).toBe(true);
      }
      expect(isNaN(parseBusinessDate("14/11/2026").getTime())).toBe(true);
    });
  });

  describe("showing a stored instant", () => {
    it("formats the Woodshop orientation at 10:30, not 11:30", () => {
      expect(formatBusinessTime(WOODSHOP_NOV_14, "en-US", { hour: "numeric", minute: "2-digit" })).toBe("10:30 AM");
      expect(toBusinessTimeInput(WOODSHOP_NOV_14)).toBe("10:30");
      expect(toBusinessDateInput(WOODSHOP_NOV_14)).toBe("2026-11-14");
      expect(toBusinessDateTimeInput(WOODSHOP_NOV_14)).toBe("2026-11-14T10:30");
    });

    it("mirrors the default shape of toLocale*String when given no options", () => {
      expect(formatBusinessDateTime(WOODSHOP_NOV_14, "en-US")).toBe("11/14/2026, 10:30:00 AM");
      expect(formatBusinessDate(WOODSHOP_NOV_14, "en-US")).toBe("11/14/2026");
      expect(formatBusinessTime(WOODSHOP_NOV_14, "en-US")).toBe("10:30:00 AM");
    });

    it("keeps caller options and still forces the business zone", () => {
      const out = formatBusinessDate(WOODSHOP_NOV_14, "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Tokyo",
      });
      expect(out).toBe("Saturday, November 14");
    });

    it("puts a late-evening session on its NWT date, not the UTC date", () => {
      // 6 pm Nov 16 in NWT is already Nov 17 in UTC.
      const lifeDrawing = "2026-11-17T00:00:00.000Z";
      expect(toBusinessDateInput(lifeDrawing)).toBe("2026-11-16");
      expect(getWallClock(lifeDrawing).weekday).toBe(1);
    });

    it("writes RFC 3339 with the -06:00 offset for Google Calendar", () => {
      expect(toBusinessIsoString(WOODSHOP_NOV_14)).toBe("2026-11-14T10:30:00-06:00");
    });

    it("formats an invalid date as 'Invalid Date' like the built-ins", () => {
      expect(formatBusinessDateTime(new Date(NaN))).toBe("Invalid Date");
      expect(toBusinessDateInput(new Date(NaN))).toBe("");
    });
  });

  describe("day arithmetic", () => {
    it("steps a weekly series without drifting off the typed time", () => {
      const first = parseBusinessDateTime("2026-10-24T10:30");
      const weeks = [1, 2, 3, 4].map((n) => toBusinessDateTimeInput(addBusinessDays(first, 7 * n)));
      expect(weeks).toEqual([
        "2026-10-31T10:30",
        "2026-11-07T10:30",
        "2026-11-14T10:30",
        "2026-11-21T10:30",
      ]);
    });

    it("steps a monthly series on the business clock, rolling overflow like setMonth", () => {
      const first = parseBusinessDateTime("2026-10-14T18:00");
      expect(toBusinessDateTimeInput(addBusinessMonths(first, 1))).toBe("2026-11-14T18:00");
      expect(toBusinessDateTimeInput(addBusinessMonths(first, 3))).toBe("2027-01-14T18:00");
      expect(toBusinessDateInput(addBusinessMonths(parseBusinessDate("2027-01-31"), 1))).toBe("2027-03-03");
    });

    it("rolls months and years over", () => {
      expect(toBusinessDateInput(addBusinessDays("2026-12-31T18:00:00Z", 1))).toBe("2027-01-01");
      expect(fromWallClock(2026, 2, 30, 9).toISOString()).toBe("2026-03-02T15:00:00.000Z");
    });

    it("finds business midnight and sets a time on the same business day", () => {
      expect(startOfBusinessDay(WOODSHOP_NOV_14).toISOString()).toBe("2026-11-14T06:00:00.000Z");
      expect(withBusinessTime(WOODSHOP_NOV_14, 13, 15).toISOString()).toBe("2026-11-14T19:15:00.000Z");
    });

    it("compares business days, not UTC days", () => {
      expect(isSameBusinessDay("2026-11-16T07:00:00Z", "2026-11-17T05:59:00Z")).toBe(true);
      expect(isSameBusinessDay("2026-11-16T05:59:00Z", "2026-11-16T06:00:00Z")).toBe(false);
    });

    it("stores the typed wall clock in the PST mirror columns", () => {
      expect(toWallClockMirror(WOODSHOP_NOV_14).toISOString()).toBe("2026-11-14T10:30:00.000Z");
    });
  });

  describe("FullCalendar named-zone bridge", () => {
    // FullCalendar arrays are [year, month0, day, hour, minute, second, ms].
    it("gives UTC-6 as -360 minutes for any wall time", () => {
      expect(offsetMinutesForWallArray([2026, 10, 14, 10, 30, 0, 0])).toBe(-360);
      expect(offsetMinutesForWallArray([2027, 6, 10, 10, 30, 0, 0])).toBe(-360);
    });

    it("reads a timestamp as a business wall-clock array, keeping milliseconds", () => {
      expect(wallArrayForTimestamp(Date.parse("2026-11-14T16:30:00.250Z"))).toEqual([2026, 10, 14, 10, 30, 0, 250]);
      expect(wallArrayForTimestamp(Date.parse("2026-11-17T00:00:00Z"))).toEqual([2026, 10, 16, 18, 0, 0, 0]);
    });

    it("round-trips: wall array minus its offset is the original instant", () => {
      const ms = Date.parse("2026-11-14T16:30:00Z");
      const a = wallArrayForTimestamp(ms);
      const wallAsUtc = Date.UTC(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
      expect(wallAsUtc - offsetMinutesForWallArray(a) * 60000).toBe(ms);
    });

    it("follows a DST zone when one is configured", () => {
      expect(offsetMinutesForWallArray([2025, 6, 1, 10, 0, 0, 0], "America/Vancouver")).toBe(-420);
      expect(offsetMinutesForWallArray([2025, 11, 1, 10, 0, 0, 0], "America/Vancouver")).toBe(-480);
    });
  });

  describe("named zones with DST, for a future rule change", () => {
    it("converts both ways across a DST boundary", () => {
      const tz = "America/Vancouver";
      const summer = fromWallClock(2025, 7, 1, 10, 30, 0, tz);
      const winter = fromWallClock(2025, 12, 1, 10, 30, 0, tz);
      expect(summer.toISOString()).toBe("2025-07-01T17:30:00.000Z");
      expect(winter.toISOString()).toBe("2025-12-01T18:30:00.000Z");
      expect(getWallClock(winter, tz).hour).toBe(10);
    });
  });

  describe("independence from the host timezone", () => {
    const results = HOST_ZONES.map((tz) => {
      const out = execFileSync(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        ["tests/helpers/business-time-snapshot.ts"],
        { env: { ...process.env, TZ: tz }, encoding: "utf8" }
      );
      return JSON.parse(out) as Record<string, string | number>;
    });

    it("runs each host zone with a genuinely different clock", () => {
      const hostHours = new Set(results.map((r) => r.hostHour));
      expect(hostHours.size).toBeGreaterThanOrEqual(5);
    });

    it("produces identical results whatever zone the server or device is in", () => {
      const strip = ({ hostHour, ...rest }: Record<string, string | number>) => rest;
      for (const r of results) expect(strip(r)).toEqual(strip(results[0]));
      expect(strip(results[0])).toEqual({
        parsed: "2026-11-14T16:30:00.000Z",
        midnight: "2026-11-16T06:00:00.000Z",
        time: "10:30:00 AM",
        dateTime: "11/16/2026, 6:00:00 PM",
        input: "2026-11-16T18:00",
        iso: "2026-11-14T10:30:00-06:00",
        weekly: "2026-11-14T10:30",
        day: "2026-11-16T06:00:00.000Z",
      });
    });
  });
});
