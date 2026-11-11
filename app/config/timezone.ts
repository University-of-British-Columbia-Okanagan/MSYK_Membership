/**
 * The one timezone every session, booking, email and calendar event is shown
 * and entered in, whatever the server or the viewer's device is set to.
 *
 * NWT stopped changing clocks on 2026-11-01 and keeps UTC-6 all year. That is
 * spelled as the fixed zone "Etc/GMT+6" (POSIX sign: "+6" means UTC-6) rather
 * than "America/Yellowknife" on purpose: a named zone is only right on devices
 * with current tz data, and stale data is exactly what shifted every session
 * by an hour in November 2026. A fixed offset reads the same everywhere.
 *
 * If NWT's rules ever change again, change this value AND re-anchor existing
 * future rows in the same deploy (see scripts/reanchor-times.cjs), or every
 * stored session moves by the difference.
 */
export const BUSINESS_TIME_ZONE = "Etc/GMT+6";
