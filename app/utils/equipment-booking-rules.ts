/**
 * Who may book equipment when. Client-safe: the booking grid greys cells out
 * with these, and the server enforces the same rules before checkout and again
 * when the booking is written, so the two can never disagree.
 *
 * Level 3: weekly allowed hours plus planned closures.
 * Level 4: one daily restricted window. Closures do not apply to level 4.
 * Other levels are handled by the permission check in bookEquipment.
 */
import { getWallClock, parseBusinessDateTime } from "~/utils/business-time";
import { FULL_DAY_NAMES } from "~/utils/business-time-equipment";

export type Level3Schedule = Record<string, { start: number; end: number; closed?: boolean }>;
export type Level4Restrictions = { start: number; end: number };
export type PlannedClosure = { startDate: Date | string; endDate: Date | string };

export type EquipmentBookingRules = {
  level3Schedule?: Level3Schedule;
  level4Restrictions?: Level4Restrictions;
  plannedClosures?: PlannedClosure[];
};

export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

/** [start, end) on the business clock; wraps overnight when start > end. 0/0 means off. */
export function isLevel4RestrictedHour(hour: number, r?: Level4Restrictions): boolean {
  if (!r || (r.start === 0 && r.end === 0)) return false;
  return r.start > r.end ? hour >= r.start || hour < r.end : hour >= r.start && hour < r.end;
}

export function isInPlannedClosure(start: Date, closures: PlannedClosure[] = []): boolean {
  const t = start.getTime();
  return closures.some((c) => t >= new Date(c.startDate).getTime() && t < new Date(c.endDate).getTime());
}

/** The reason a slot starting at `start` may not be booked, or null if it may. */
export function getEquipmentBookingViolation(
  roleLevel: number,
  start: Date,
  rules: EquipmentBookingRules
): string | null {
  const { weekday, hour } = getWallClock(start);

  if (roleLevel === 3) {
    const dayName = FULL_DAY_NAMES[weekday];
    const day = rules.level3Schedule?.[dayName];
    if (day?.closed) return `Level 3 members cannot book equipment on ${dayName}.`;
    if (day && (hour < day.start || hour >= day.end)) {
      return `Level 3 members can only book between ${formatHour(day.start)} and ${formatHour(day.end)} on ${dayName}. Please contact support.`;
    }
    if (isInPlannedClosure(start, rules.plannedClosures)) {
      return "That time falls in a planned closure. Please choose another time.";
    }
  }

  if (roleLevel === 4 && isLevel4RestrictedHour(hour, rules.level4Restrictions)) {
    const r = rules.level4Restrictions!;
    return `Level 4 members cannot book between ${formatHour(r.start)} and ${formatHour(r.end)}.`;
  }

  return null;
}

/**
 * Start and end of each of the grid's "<start>|<end>" slot strings (or a JSON
 * string of them), or null when the payload is missing or malformed.
 */
export function parseSlotRanges(raw: unknown): Array<{ start: Date; end: Date }> | null {
  let slots: unknown = raw;
  if (typeof raw === "string") {
    try {
      slots = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const ranges = slots.map((s) => {
    const [start, end] = typeof s === "string" ? s.split("|") : [];
    return { start: parseBusinessDateTime(start), end: parseBusinessDateTime(end) };
  });
  return ranges.some((r) => isNaN(r.start.getTime()) || isNaN(r.end.getTime())) ? null : ranges;
}
