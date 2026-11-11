// Run as a child process with a real TZ by tests/utils/business-time.test.ts.
// Jest workers ignore process.env.TZ changes, so in-process zone tests prove nothing.
import {
  addBusinessDays,
  formatBusinessDateTime,
  formatBusinessTime,
  parseBusinessDate,
  parseBusinessDateTime,
  startOfBusinessDay,
  toBusinessDateTimeInput,
  toBusinessIsoString,
} from "~/utils/business-time";

const WOODSHOP = "2026-11-14T16:30:00.000Z";

process.stdout.write(
  JSON.stringify({
    hostHour: new Date(WOODSHOP).getHours(),
    parsed: parseBusinessDateTime("2026-11-14T10:30").toISOString(),
    midnight: parseBusinessDate("2026-11-16").toISOString(),
    time: formatBusinessTime(WOODSHOP, "en-US"),
    dateTime: formatBusinessDateTime("2026-11-17T00:00:00Z", "en-US"),
    input: toBusinessDateTimeInput("2026-11-17T00:00:00Z"),
    iso: toBusinessIsoString(WOODSHOP),
    weekly: toBusinessDateTimeInput(addBusinessDays(parseBusinessDateTime("2026-10-24T10:30"), 21)),
    day: startOfBusinessDay("2026-11-17T00:00:00Z").toISOString(),
  })
);
