/**
 * Shared occurrence-date helpers for the workshop date editors.
 *
 * Add Workshop, Edit Workshop and Offer Again each grew their own copy of this
 * logic. Keeping it here means the rules below hold on all three pages, and are
 * reachable from Jest — the route versions were closures inside 2,000+ line
 * components and could not be tested at all.
 */

export interface OccurrenceDates {
  startDate: Date;
  endDate: Date;
}

/**
 * Replaces one date field on one occurrence.
 *
 * Start and end are independent: setting a start never derives an end from it.
 * An earlier version added two hours to the start on every start edit, which
 * silently collapsed sessions the admin had given a different duration.
 *
 * Returns a new array of new objects — callers hold the previous array in React
 * state, and mutating it in place made the old value and the new one the same.
 */
export function setOccurrenceDateField<T extends OccurrenceDates>(
  occurrences: T[],
  index: number,
  field: "startDate" | "endDate",
  value: Date
): T[] {
  return occurrences.map((occurrence, i) => {
    if (i !== index) return occurrence;
    return field === "startDate"
      ? { ...occurrence, startDate: value }
      : { ...occurrence, endDate: value };
  });
}

/**
 * Chronological order, tolerating the invalid dates a freshly added row carries.
 *
 * A plain `a - b` comparator returns NaN against an unfilled row, which V8 reads
 * as "equal" and treats as a wall — elements on either side never compare, so
 * the array is left partially sorted. Unfilled rows sink to the bottom instead.
 */
export function sortOccurrencesByStart<T extends OccurrenceDates>(
  occurrences: T[]
): T[] {
  return [...occurrences].sort((a, b) => {
    const aTime = a.startDate.getTime();
    const bTime = b.startDate.getTime();
    const aInvalid = isNaN(aTime);
    const bInvalid = isNaN(bTime);
    if (aInvalid && bInvalid) return 0;
    if (aInvalid) return 1;
    if (bInvalid) return -1;
    return aTime - bTime;
  });
}

/**
 * True when an occurrence ends at or before it starts, so the row can say so
 * before the admin hits save. Rows still being filled in are not flagged; the
 * form schema reports a missing date separately.
 */
export function isEndBeforeStart(occurrence: OccurrenceDates): boolean {
  const start = occurrence.startDate?.getTime();
  const end = occurrence.endDate?.getTime();
  if (start === undefined || end === undefined) return false;
  if (isNaN(start) || isNaN(end)) return false;
  return end <= start;
}
