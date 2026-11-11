/**
 * Fails when app code reads or writes a date on the host's clock instead of
 * the business clock (app/utils/business-time.ts).
 *
 * Host-clock calls give a different answer on the server, on a member's phone
 * and on an admin's laptop, and they all go wrong when a device's tz data is
 * stale. That is what moved every November 2026 session by an hour.
 *
 * A line that genuinely means the host clock, or formats a number rather than
 * a date, opts out with a trailing comment: `// host-clock-ok: <reason>`.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "app");

// Files whose date maths is deliberately not on the business clock.
const EXEMPT_FILES = new Set([
  "utils/business-time.ts",
  // Birthdays are calendar dates compared component by component; see the file header.
  "utils/age.ts",
]);

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\.toLocale(Date|Time)?String\(/, "toLocale*String() formats in the host zone; use formatBusiness*()"],
  [/\.get(Hours|Minutes|Day|Date|Month|FullYear)\(\)/, "host-clock getter; use getWallClock()"],
  [/\.set(Hours|Minutes|Date|Month|FullYear)\(/, "host-clock setter; use fromWallClock()/addBusinessDays()/withBusinessTime()"],
  [/getTimezoneOffset\(/, "host offset; use toWallClockMirror() or fromWallClock()"],
  [/new Date\(\s*[A-Za-z_$][\w$.]*\s*,/, "local-time constructor; use fromWallClock()"],
  [/Date\.parse\(/, "parses offset-less strings in the host zone; use parseBusinessDateTime()"],
  [/new Date\([\w$.]*\.target\.value\)/, "input values have no offset; use parseBusinessDate()/parseBusinessDateTime()"],
  [/\.to(Date|Time)String\(\)/, "host-clock day or time; use toBusinessDateInput()/isSameBusinessDay()"],
  [/toISOString\(\)\.(split|slice|substring)\(/, "that is the UTC day, not the business day; use toBusinessDateInput()"],
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

describe("business-time guard", () => {
  it("finds no host-clock date calls in app/", () => {
    const violations: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = path.relative(ROOT, file);
      if (EXEMPT_FILES.has(rel)) continue;
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
          if (line.includes("host-clock-ok:")) return;
          for (const [re, why] of FORBIDDEN) {
            if (re.test(line)) violations.push(`app/${rel}:${i + 1}  ${why}\n    ${trimmed}`);
          }
        });
    }
    expect(violations).toEqual([]);
  });

  it("actually detects a violation, so a green run means something", () => {
    for (const [re] of FORBIDDEN) expect(re.source.length).toBeGreaterThan(0);
    const sample = [
      "d.toLocaleString()",
      "d.toLocaleTimeString('en-US')",
      "d.getHours()",
      "d.setHours(10, 0)",
      "d.getTimezoneOffset()",
      "new Date(year, month - 1, day)",
      "Date.parse(value)",
      "const date = new Date(e.target.value);",
      "a.toDateString() === b.toDateString()",
      'd.toISOString().split("T")[0]',
    ];
    for (const s of sample) expect(FORBIDDEN.some(([re]) => re.test(s))).toBe(true);
    expect(FORBIDDEN.some(([re]) => re.test("new Date(occ.startDate)"))).toBe(false);
    expect(FORBIDDEN.some(([re]) => re.test("new Date()"))).toBe(false);
  });
});
