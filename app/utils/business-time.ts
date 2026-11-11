/**
 * Business-clock date handling. Client-safe: imported by forms and cards.
 *
 * Every instant is stored in UTC. Anything a person reads or types is a wall
 * clock time in BUSINESS_TIME_ZONE, never the server's or the device's zone.
 * Do not use toLocale*String(), getHours() and friends, or new Date(y, m, d)
 * on session times; use these helpers. tests/utils/business-time.guard.test.ts
 * fails the build when a bare call creeps back in.
 */
import { BUSINESS_TIME_ZONE } from "~/config/timezone";

export { BUSINESS_TIME_ZONE };

type DateInput = Date | string | number;

export type WallClock = {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday, matching Date.getDay() */
  weekday: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The wall clock reading of an instant in `timeZone` (default: business zone). */
export function getWallClock(
  input: DateInput,
  timeZone: string = BUSINESS_TIME_ZONE
): WallClock {
  const date = toDate(input);
  if (isNaN(date.getTime())) {
    return { year: NaN, month: NaN, day: NaN, hour: NaN, minute: NaN, second: NaN, weekday: NaN };
  }
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

/** Offset of `timeZone` from UTC at `utcMs`, in ms (UTC-6 gives -21600000). */
function offsetAt(utcMs: number, timeZone: string): number {
  const w = getWallClock(utcMs, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The instant at which the business clock reads the given wall time.
 * `month` is 1-12. Out-of-range values roll over like Date.UTC does, so
 * `day + 7` is a safe way to step a week.
 */
export function fromWallClock(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone: string = BUSINESS_TIME_ZONE
): Date {
  if ([year, month, day, hour, minute, second].some((n) => !Number.isFinite(n))) {
    return new Date(NaN);
  }
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  // Two passes settle the offset when the guess and the answer straddle a rule change.
  const first = guess - offsetAt(guess, timeZone);
  return new Date(guess - offsetAt(first, timeZone));
}

/**
 * Parse "YYYY-MM-DDTHH:mm" (or with a space, or with ":ss") as business wall
 * time. Strings carrying their own offset or a trailing Z are real instants
 * and parse as such. Anything unparseable returns an invalid Date.
 */
export function parseBusinessDateTime(value: string | null | undefined): Date {
  if (!value) return new Date(NaN);
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return fromWallClock(+y, +mo, +d, +h, +mi, s ? +s : 0);
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? parseBusinessDate(value)
    : new Date(value);
  return isNaN(date.getTime()) ? new Date(NaN) : date;
}

/** Parse "YYYY-MM-DD" as midnight on the business clock. */
export function parseBusinessDate(value: string | null | undefined): Date {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim()) : null;
  if (!m) return new Date(NaN);
  return fromWallClock(+m[1], +m[2], +m[3]);
}

/** "YYYY-MM-DD" on the business clock, for <input type="date"> and day keys. */
export function toBusinessDateInput(input: DateInput): string {
  const w = getWallClock(input);
  if (isNaN(w.year)) return "";
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** "HH:mm" (24h) on the business clock. */
export function toBusinessTimeInput(input: DateInput): string {
  const w = getWallClock(input);
  if (isNaN(w.year)) return "";
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" on the business clock; the inverse of parseBusinessDateTime. */
export function toBusinessDateTimeInput(input: DateInput): string {
  const d = toBusinessDateInput(input);
  return d ? `${d}T${toBusinessTimeInput(input)}` : "";
}

/** RFC 3339 with the business offset, e.g. 2026-11-14T10:30:00-06:00. */
export function toBusinessIsoString(input: DateInput): string {
  const date = toDate(input);
  const w = getWallClock(date);
  const off = offsetAt(date.getTime(), BUSINESS_TIME_ZONE) / 60000;
  const sign = off <= 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Midnight on the business clock, on the same business day as `input`. */
export function startOfBusinessDay(input: DateInput): Date {
  const w = getWallClock(input);
  return fromWallClock(w.year, w.month, w.day);
}

/** Same business wall time, `days` later. Safe across any offset change. */
export function addBusinessDays(input: DateInput, days: number): Date {
  const w = getWallClock(input);
  return fromWallClock(w.year, w.month, w.day + days, w.hour, w.minute, w.second);
}

/** Same business wall time, `months` later. Overflow rolls like Date.setMonth (Jan 31 + 1 is Mar 3). */
export function addBusinessMonths(input: DateInput, months: number): Date {
  const w = getWallClock(input);
  return fromWallClock(w.year, w.month + months, w.day, w.hour, w.minute, w.second);
}

/** Same business wall time on another business date. */
export function withBusinessTime(
  input: DateInput,
  hour: number,
  minute = 0,
  second = 0
): Date {
  const w = getWallClock(input);
  return fromWallClock(w.year, w.month, w.day, hour, minute, second);
}

export function isSameBusinessDay(a: DateInput, b: DateInput): boolean {
  return toBusinessDateInput(a) === toBusinessDateInput(b);
}

/**
 * A Date whose UTC fields hold the business wall clock. This is what the
 * startDatePST/endDatePST columns store: the time as the admin typed it, kept
 * so future rows can be re-anchored if the business zone's rules change.
 */
export function toWallClockMirror(input: DateInput): Date {
  const w = getWallClock(input);
  return new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second));
}

function withZone(
  options: Intl.DateTimeFormatOptions | undefined
): Intl.DateTimeFormatOptions {
  return { ...options, timeZone: BUSINESS_TIME_ZONE };
}

function safeFormat(
  input: DateInput,
  locale: string | string[] | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const date = toDate(input);
  if (isNaN(date.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/** Business-clock toLocaleString(): date and time unless options say otherwise. */
export function formatBusinessDateTime(
  input: DateInput,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  const o = withZone(options);
  const hasFields = options && Object.keys(options).some((k) => k !== "timeZone");
  return safeFormat(
    input,
    locale,
    hasFields
      ? o
      : { ...o, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }
  );
}

/** Business-clock toLocaleDateString(). */
export function formatBusinessDate(
  input: DateInput,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  const o = withZone(options);
  const hasFields = options && Object.keys(options).some((k) => k !== "timeZone");
  return safeFormat(input, locale, hasFields ? o : { ...o, year: "numeric", month: "numeric", day: "numeric" });
}

/** Business-clock toLocaleTimeString(). */
export function formatBusinessTime(
  input: DateInput,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  const o = withZone(options);
  const hasFields = options && Object.keys(options).some((k) => k !== "timeZone");
  return safeFormat(
    input,
    locale,
    hasFields ? o : { ...o, hour: "numeric", minute: "2-digit", second: "2-digit" }
  );
}

/**
 * FullCalendar named-zone bridge. Arrays are [year, month0, day, hour, minute,
 * second, ms]; offsets are minutes east of UTC (UTC-6 is -360), as FullCalendar expects.
 */
export function offsetMinutesForWallArray(
  a: number[],
  timeZone: string = BUSINESS_TIME_ZONE
): number {
  const instant = fromWallClock(a[0], a[1] + 1, a[2], a[3] ?? 0, a[4] ?? 0, a[5] ?? 0, timeZone);
  const wallAsUtc = Date.UTC(a[0], a[1], a[2], a[3] ?? 0, a[4] ?? 0, a[5] ?? 0);
  return (wallAsUtc - instant.getTime()) / 60000;
}

export function wallArrayForTimestamp(
  ms: number,
  timeZone: string = BUSINESS_TIME_ZONE
): number[] {
  const w = getWallClock(ms, timeZone);
  return [w.year, w.month - 1, w.day, w.hour, w.minute, w.second, ((ms % 1000) + 1000) % 1000];
}
