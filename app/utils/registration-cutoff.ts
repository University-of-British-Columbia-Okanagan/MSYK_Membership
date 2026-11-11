/** True once a workshop's registration cutoff (minutes before the first session) has passed. */
export function isPastRegistrationCutoff(
  startDate: Date,
  cutoffMinutes?: number | null
): boolean {
  if (!cutoffMinutes || cutoffMinutes <= 0) {
    return false;
  }
  const cutoffTime = new Date(new Date(startDate).getTime() - cutoffMinutes * 60_000);
  return new Date() >= cutoffTime;
}
