/**
 * Equipment booking grid keys on the business clock. Client-safe: shared by
 * getEquipmentSlotsWithStatus() on the server and EquipmentBookingGrid in the
 * browser, so both sides name a cell the same way whatever zone they run in.
 *
 * A grid column is keyed "Thu 12" (short weekday, business day of month) and
 * a row "HH:mm". The key carries no month or year, so turning it back into an
 * instant means finding that date in the window the grid shows.
 */
import {
  fromWallClock,
  getWallClock,
  toBusinessTimeInput,
} from "./business-time";

type DateInput = Date | string | number;

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Grid column key, e.g. "Thu 12", for the business day `input` falls on. */
export function equipmentDayKey(input: DateInput): string {
  const w = getWallClock(input);
  if (isNaN(w.year)) return "";
  return `${SHORT_DAYS[w.weekday]} ${w.day}`;
}

/** Grid row key "HH:mm" on the business clock. */
export function equipmentTimeKey(input: DateInput): string {
  return toBusinessTimeInput(input);
}

export type EquipmentGridDay = {
  key: string;
  /** Business midnight of this day. */
  date: Date;
};

/** The `count` business days starting with today, in order. */
export function equipmentGridDays(
  count: number,
  now: DateInput = new Date()
): EquipmentGridDay[] {
  const today = getWallClock(now);
  const days: EquipmentGridDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = fromWallClock(today.year, today.month, today.day + i);
    days.push({ key: equipmentDayKey(date), date });
  }
  return days;
}

/**
 * Returns a function mapping a grid cell ("Thu 12", "10:30") to its instant.
 * Keys in the visible window resolve exactly; anything else is matched to the
 * nearest date carrying that weekday and day number.
 */
export function createEquipmentCellResolver(
  visibleDays: number,
  now: DateInput = new Date()
): (dayKey: string, time: string) => Date {
  const midnights = new Map<string, Date | null>();
  for (const d of equipmentGridDays(visibleDays, now)) {
    if (!midnights.has(d.key)) midnights.set(d.key, d.date);
  }
  const today = getWallClock(now);

  const findMidnight = (dayKey: string): Date | null => {
    const known = midnights.get(dayKey);
    if (known !== undefined) return known;
    for (let k = 1; k <= 400; k++) {
      for (const offset of [k, -k]) {
        const date = fromWallClock(today.year, today.month, today.day + offset);
        if (equipmentDayKey(date) === dayKey) {
          midnights.set(dayKey, date);
          return date;
        }
      }
    }
    midnights.set(dayKey, null);
    return null;
  };

  // The grid asks for every cell several times per render.
  const cells = new Map<string, number>();
  return (dayKey, time) => {
    const cacheKey = `${dayKey}|${time}`;
    let ms = cells.get(cacheKey);
    if (ms === undefined) {
      const midnight = findMidnight(dayKey);
      const [hour, minute] = time.split(":").map(Number);
      if (!midnight || !Number.isFinite(hour) || !Number.isFinite(minute)) {
        ms = NaN;
      } else {
        const w = getWallClock(midnight);
        ms = fromWallClock(w.year, w.month, w.day, hour, minute).getTime();
      }
      cells.set(cacheKey, ms);
    }
    return new Date(ms);
  };
}
