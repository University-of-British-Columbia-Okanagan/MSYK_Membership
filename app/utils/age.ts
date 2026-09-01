/**
 * Age helpers shared by the registration schema, the register route action, and the
 * register form. All three used to carry their own copy of this arithmetic.
 *
 * This is a plain `.ts`, not `.server.ts`, because the register form imports it to decide
 * which notice to show while the user is picking a birthday. Keep it free of server-only
 * imports.
 */

/** Youngest age that may hold a portal account at all. */
export const MINIMUM_REGISTRATION_AGE = 14;

/** Oldest age that still needs a legal guardian named on the registration form. */
export const GUARDIAN_REQUIRED_MAX_AGE = 17;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Splits "YYYY-MM-DD" into calendar parts, rejecting dates the calendar does not have.
 *
 * Deliberately does not go through `new Date(string)`: that parses a bare date as UTC
 * midnight, and reading it back with local getters lands on the previous day anywhere west
 * of Greenwich. In Yellowknife that let a 13 year old through the day before their 14th
 * birthday, because the shifted-earlier date reads as a birthday already passed.
 */
function parseCalendarDate(
  value: string
): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Round-trip through a local Date to reject Feb 31 and friends. The day dropdown offers
  // 31 days for every month, so those combinations are reachable from the UI.
  const asDate = new Date(year, month - 1, day);
  if (
    asDate.getFullYear() !== year ||
    asDate.getMonth() !== month - 1 ||
    asDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * Whole years between a date of birth and `now`.
 *
 * @returns the age, or null when the date is missing, malformed, not a real calendar date,
 * or in the future. A null means "unusable input", not "too young".
 */
export function calculateAge(
  dateOfBirth: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (dateOfBirth === null || dateOfBirth === undefined) return null;

  let parts: { year: number; month: number; day: number } | null;

  if (dateOfBirth instanceof Date) {
    if (Number.isNaN(dateOfBirth.getTime())) return null;
    parts = {
      year: dateOfBirth.getFullYear(),
      month: dateOfBirth.getMonth() + 1,
      day: dateOfBirth.getDate(),
    };
  } else {
    parts = parseCalendarDate(dateOfBirth);
  }

  if (!parts) return null;

  let age = now.getFullYear() - parts.year;
  const monthDiff = now.getMonth() + 1 - parts.month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parts.day)) {
    age--;
  }

  return age < 0 ? null : age;
}

/**
 * Splits a stored date of birth back into the exact option values the register form's
 * Month/Day/Year selects carry, so they can be repopulated after the route restores the
 * form following a server error. Month and day stay zero padded because the options are
 * built that way and an unpadded "3" would match nothing.
 *
 * @returns null for anything that is not a complete, real calendar date, which leaves a
 * half-finished selection in the form untouched.
 */
export function splitDateOfBirth(
  value: string | null | undefined
): { year: string; month: string; day: string } | null {
  if (!value) return null;

  const parts = parseCalendarDate(value);
  if (!parts) return null;

  return {
    year: String(parts.year).padStart(4, "0"),
    month: String(parts.month).padStart(2, "0"),
    day: String(parts.day).padStart(2, "0"),
  };
}

/** True for the 14-17 band, who must name a legal guardian to register. */
export function requiresGuardian(age: number | null): boolean {
  if (age === null) return false;
  return age >= MINIMUM_REGISTRATION_AGE && age <= GUARDIAN_REQUIRED_MAX_AGE;
}

/** True below the minimum age. An unknown age is a validity problem, not an age one. */
export function isTooYoungToRegister(age: number | null): boolean {
  if (age === null) return false;
  return age < MINIMUM_REGISTRATION_AGE;
}
