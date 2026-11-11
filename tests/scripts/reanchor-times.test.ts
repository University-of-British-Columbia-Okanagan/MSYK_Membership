// eslint-disable-next-line @typescript-eslint/no-var-requires
const { legacyMountainOffset, offsetFn, reanchor, parseArgs } = require("../../scripts/reanchor-times.cjs");

const HOUR = 3600 * 1000;
const ms = (iso: string) => new Date(iso).getTime();
const iso = (n: number) => new Date(n).toISOString();

describe("reanchor-times", () => {
  describe("legacy-mountain-dst, the rule the November sessions were saved under", () => {
    it("falls back at 02:00 MDT on the first Sunday of November", () => {
      expect(legacyMountainOffset(ms("2026-11-01T07:59:59Z"))).toBe(-6 * HOUR);
      expect(legacyMountainOffset(ms("2026-11-01T08:00:00Z"))).toBe(-7 * HOUR);
    });

    it("springs forward at 02:00 MST on the second Sunday of March", () => {
      expect(legacyMountainOffset(ms("2027-03-14T08:59:59Z"))).toBe(-7 * HOUR);
      expect(legacyMountainOffset(ms("2027-03-14T09:00:00Z"))).toBe(-6 * HOUR);
    });
  });

  describe("the production repair: legacy-mountain-dst -> Etc/GMT+6", () => {
    const from = offsetFn("legacy-mountain-dst");
    const to = offsetFn("Etc/GMT+6");

    it.each([
      ["74 Woodshop 10:30", "2026-11-14T17:30:00.000Z", "2026-11-14T16:30:00.000Z"],
      ["80 Laser 11:00", "2026-11-14T18:00:00.000Z", "2026-11-14T17:00:00.000Z"],
      ["78 Sewing 12:00", "2026-11-14T19:00:00.000Z", "2026-11-14T18:00:00.000Z"],
      ["79 Life Drawing 17:00", "2026-11-17T00:00:00.000Z", "2026-11-16T23:00:00.000Z"],
      ["81 3D Printing 10:00", "2026-11-28T17:00:00.000Z", "2026-11-28T16:00:00.000Z"],
      ["69 Woodshop 10:30", "2026-12-05T17:30:00.000Z", "2026-12-05T16:30:00.000Z"],
    ])("moves %s back one hour to its typed time", (_label, stored, expected) => {
      expect(iso(reanchor(ms(stored), from, to))).toBe(expected);
    });

    it("leaves sessions saved under summer time alone, since both rules agree there", () => {
      expect(iso(reanchor(ms("2026-10-17T16:30:00Z"), from, to))).toBe("2026-10-17T16:30:00.000Z");
      expect(iso(reanchor(ms("2027-07-10T16:30:00Z"), from, to))).toBe("2027-07-10T16:30:00.000Z");
    });

    it("also moves a session saved for next winter", () => {
      expect(iso(reanchor(ms("2027-12-04T17:30:00Z"), from, to))).toBe("2027-12-04T16:30:00.000Z");
    });

    it("is not idempotent, which is why --apply records a marker", () => {
      const once = reanchor(ms("2026-11-14T17:30:00Z"), from, to);
      expect(reanchor(once, from, to)).not.toBe(once);
    });
  });

  describe("a future rule change", () => {
    it("keeps the typed wall time when moving from UTC-6 to UTC-7", () => {
      const moved = reanchor(ms("2028-01-10T16:30:00Z"), offsetFn("Etc/GMT+6"), offsetFn("Etc/GMT+7"));
      expect(iso(moved)).toBe("2028-01-10T17:30:00.000Z");
    });

    it("is a no-op when the rule does not change", () => {
      const same = offsetFn("Etc/GMT+6");
      expect(iso(reanchor(ms("2026-11-14T16:30:00Z"), same, same))).toBe("2026-11-14T16:30:00.000Z");
    });

    it("rejects an unknown zone before touching anything", () => {
      expect(() => offsetFn("Mars/Olympus_Mons")).toThrow(RangeError);
    });
  });

  describe("arguments", () => {
    const base = ["-", "--from=legacy-mountain-dst", "--to=Etc/GMT+6", "--since=2026-11-01"];

    it("defaults to a dry run", () => {
      expect(parseArgs(base).apply).toBe(false);
    });

    it("refuses --apply without the reviewed --ids", () => {
      expect(() => parseArgs([...base, "--apply"])).toThrow(/--ids/);
    });

    it("parses ids and slot ids", () => {
      const a = parseArgs([...base, "--apply", "--ids=74,80", "--slot-ids=5"]);
      expect(a.ids).toEqual([74, 80]);
      expect(a.slotIds).toEqual([5]);
    });

    it("requires from, to and a YYYY-MM-DD since", () => {
      expect(() => parseArgs(["--from=Etc/GMT+6", "--to=Etc/GMT+6", "--since=Nov 1"])).toThrow(/Required/);
      expect(() => parseArgs([...base, "--typo"])).toThrow(/Unknown argument/);
    });
  });
});
