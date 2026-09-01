import {
  MINIMUM_REGISTRATION_AGE,
  GUARDIAN_REQUIRED_MAX_AGE,
  calculateAge,
  requiresGuardian,
  isTooYoungToRegister,
  splitDateOfBirth,
} from "~/utils/age";

/**
 * The registration age gate moved from 18+ to 14+, and 14-17 now carries a required
 * guardian name. The boundary is therefore load-bearing in a way it was not before, so
 * these cases pin the exact day the age ticks over.
 *
 * The old inline age math ran the "YYYY-MM-DD" string through `new Date()`, which parses
 * it as UTC midnight, and then read it back with local getters. West of UTC that reports
 * the previous day, which reads as a birthday already passed, so in Yellowknife a 13 year
 * old was let through a day early. calculateAge parses the components directly instead.
 * The `is not shifted a day by the local timezone` cases below pin that boundary.
 */
describe("age", () => {
  const on = (iso: string) => new Date(`${iso}T12:00:00`);

  describe("calculateAge", () => {
    it("counts a birthday that has already passed this year", () => {
      expect(calculateAge("2000-01-10", on("2026-08-28"))).toBe(26);
    });

    it("does not count a birthday still to come this year", () => {
      expect(calculateAge("2000-12-10", on("2026-08-28"))).toBe(25);
    });

    it("counts the birthday itself as the new age", () => {
      expect(calculateAge("2012-08-28", on("2026-08-28"))).toBe(14);
    });

    it("does not count the day before the birthday", () => {
      expect(calculateAge("2012-08-28", on("2026-08-27"))).toBe(13);
    });

    it("counts the day after the birthday", () => {
      expect(calculateAge("2012-08-28", on("2026-08-29"))).toBe(14);
    });

    it("handles a month boundary where the day is later in the month", () => {
      // Born Sept 1, evaluated Aug 31: the month has not arrived yet.
      expect(calculateAge("2012-09-01", on("2026-08-31"))).toBe(13);
    });

    it("handles a month boundary where the day is earlier in the month", () => {
      expect(calculateAge("2012-07-31", on("2026-08-01"))).toBe(14);
    });

    it("treats a Feb 29 birthday as having passed by Mar 1 in a non-leap year", () => {
      expect(calculateAge("2012-02-29", on("2026-03-01"))).toBe(14);
    });

    it("has not yet counted a Feb 29 birthday on Feb 28 of a non-leap year", () => {
      expect(calculateAge("2012-02-29", on("2026-02-28"))).toBe(13);
    });

    it("is not shifted a day by the local timezone", () => {
      // The whole point of parsing components rather than using Date parsing: a UTC-parsed
      // "2012-08-28" read back with local getters lands on Aug 27 west of Greenwich.
      expect(calculateAge("2012-08-28", on("2026-08-28"))).toBe(14);
      expect(calculateAge("2012-08-28", new Date("2026-08-28T00:30:00"))).toBe(14);
      expect(calculateAge("2012-08-28", new Date("2026-08-28T23:30:00"))).toBe(14);
    });

    it("accepts a Date as well as a string", () => {
      expect(calculateAge(new Date("2000-01-10T12:00:00"), on("2026-08-28"))).toBe(26);
    });

    it("returns null for an Invalid Date object", () => {
      expect(calculateAge(new Date("nonsense"), on("2026-08-28"))).toBeNull();
    });

    it("does not admit a 13 year old the day before their 14th birthday", () => {
      // The exact regression the component parsing exists to prevent. The old UTC-parsed
      // implementation returned 14 here once the local date shifted back a day.
      expect(calculateAge("2012-08-28", on("2026-08-27"))).toBe(13);
      expect(calculateAge("2012-09-01", on("2026-08-31"))).toBe(13);
      expect(calculateAge("2012-01-01", on("2011-12-31"))).toBeNull();
    });

    it("returns null for an empty value", () => {
      expect(calculateAge("", on("2026-08-28"))).toBeNull();
      expect(calculateAge(null, on("2026-08-28"))).toBeNull();
      expect(calculateAge(undefined, on("2026-08-28"))).toBeNull();
    });

    it("returns null for a malformed string", () => {
      expect(calculateAge("not-a-date", on("2026-08-28"))).toBeNull();
      expect(calculateAge("28-08-2012", on("2026-08-28"))).toBeNull();
      expect(calculateAge("2012-8-28", on("2026-08-28"))).toBeNull();
    });

    it("returns null for a calendar date that does not exist", () => {
      // The day select offers 1-31 for every month, so Feb 31 is reachable in the UI.
      expect(calculateAge("2011-02-31", on("2026-08-28"))).toBeNull();
      expect(calculateAge("2011-13-01", on("2026-08-28"))).toBeNull();
      expect(calculateAge("2011-00-10", on("2026-08-28"))).toBeNull();
      expect(calculateAge("2013-02-29", on("2026-08-28"))).toBeNull();
    });

    it("returns null for a date in the future", () => {
      expect(calculateAge("2027-01-01", on("2026-08-28"))).toBeNull();
    });

    it("returns 0 for someone born today", () => {
      expect(calculateAge("2026-08-28", on("2026-08-28"))).toBe(0);
    });

    it("defaults to today when no reference date is given", () => {
      // How the schema and the form both call it.
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-28T12:00:00"));
      try {
        expect(calculateAge("2012-08-28")).toBe(14);
        expect(calculateAge("2012-08-29")).toBe(13);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("requiresGuardian", () => {
    it("is true across the whole 14 to 17 band", () => {
      expect(requiresGuardian(14)).toBe(true);
      expect(requiresGuardian(15)).toBe(true);
      expect(requiresGuardian(16)).toBe(true);
      expect(requiresGuardian(17)).toBe(true);
    });

    it("is false at 18 and above", () => {
      expect(requiresGuardian(18)).toBe(false);
      expect(requiresGuardian(45)).toBe(false);
    });

    it("is false below 14, who cannot register at all", () => {
      expect(requiresGuardian(13)).toBe(false);
      expect(requiresGuardian(0)).toBe(false);
    });

    it("is false for an unknown age", () => {
      expect(requiresGuardian(null)).toBe(false);
    });
  });

  describe("isTooYoungToRegister", () => {
    it("is true below 14", () => {
      expect(isTooYoungToRegister(13)).toBe(true);
      expect(isTooYoungToRegister(0)).toBe(true);
    });

    it("is false from 14 up", () => {
      expect(isTooYoungToRegister(14)).toBe(false);
      expect(isTooYoungToRegister(18)).toBe(false);
    });

    it("is false for an unknown age, which is a validity problem rather than an age one", () => {
      expect(isTooYoungToRegister(null)).toBe(false);
    });
  });

  /**
   * The register form keeps the Month/Day/Year selects in local state and only writes the
   * joined "YYYY-MM-DD" into the form when all three are set. After a server error the
   * route restores the form with `form.reset()`, which puts the date back but leaves the
   * three selects reading their initial empty state, so the birthday looked unset while a
   * value was in fact submitted. splitDateOfBirth feeds those selects back from the
   * restored value, so it has to emit exactly the strings the options carry.
   */
  describe("splitDateOfBirth", () => {
    it("splits a date into the option values the selects use", () => {
      expect(splitDateOfBirth("2011-03-04")).toEqual({
        year: "2011",
        month: "03",
        day: "04",
      });
    });

    it("keeps month and day zero padded, matching the option values", () => {
      // The options are built with String(n).padStart(2, "0"), so "3" would select nothing.
      const parts = splitDateOfBirth("2011-03-04");
      expect(parts?.month).toBe("03");
      expect(parts?.day).toBe("04");
    });

    it("does not pad a two digit month or day", () => {
      expect(splitDateOfBirth("1990-12-25")).toEqual({
        year: "1990",
        month: "12",
        day: "25",
      });
    });

    it("returns null for an empty value, so a blank form stays blank", () => {
      expect(splitDateOfBirth("")).toBeNull();
      expect(splitDateOfBirth(null)).toBeNull();
      expect(splitDateOfBirth(undefined)).toBeNull();
    });

    it("returns null for a malformed value", () => {
      expect(splitDateOfBirth("not-a-date")).toBeNull();
      expect(splitDateOfBirth("2011-3-4")).toBeNull();
      expect(splitDateOfBirth("04-03-2011")).toBeNull();
    });

    it("returns null for a date the calendar does not have", () => {
      expect(splitDateOfBirth("2011-02-31")).toBeNull();
      expect(splitDateOfBirth("2011-13-01")).toBeNull();
    });

    it("returns null for a partial date, so an in-progress selection is not clobbered", () => {
      // While the user is still picking, the form value is "" rather than a partial string.
      // Anything short of a full date must be left alone.
      expect(splitDateOfBirth("2011")).toBeNull();
      expect(splitDateOfBirth("2011-03")).toBeNull();
      expect(splitDateOfBirth("--04")).toBeNull();
    });

    it("round-trips a date that calculateAge accepts", () => {
      const iso = "2012-08-28";
      const parts = splitDateOfBirth(iso);
      expect(`${parts!.year}-${parts!.month}-${parts!.day}`).toBe(iso);
      expect(calculateAge(iso, new Date("2026-08-28T12:00:00"))).toBe(14);
    });

    it("accepts a leap day", () => {
      expect(splitDateOfBirth("2012-02-29")).toEqual({
        year: "2012",
        month: "02",
        day: "29",
      });
    });
  });

  it("exposes the boundaries it enforces", () => {
    expect(MINIMUM_REGISTRATION_AGE).toBe(14);
    expect(GUARDIAN_REQUIRED_MAX_AGE).toBe(17);
  });
});
