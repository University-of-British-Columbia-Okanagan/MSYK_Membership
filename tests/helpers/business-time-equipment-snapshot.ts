// Run as a child process with a real TZ by tests/utils/business-time-equipment.test.ts.
// Jest workers ignore process.env.TZ changes, so in-process zone tests prove nothing.
import {
  createEquipmentCellResolver,
  equipmentDayKey,
  equipmentGridDays,
  equipmentTimeKey,
} from "~/utils/business-time-equipment";

// Business Sat Nov 28 2026, 21:00: already Sunday in UTC and Tokyo.
const NOW = "2026-11-29T03:00:00.000Z";
const resolve = createEquipmentCellResolver(7, NOW);

process.stdout.write(
  JSON.stringify({
    hostHour: new Date(NOW).getHours(),
    days: equipmentGridDays(7, NOW).map((d) => d.key),
    slotDay: equipmentDayKey("2026-11-29T05:30:00Z"),
    slotTime: equipmentTimeKey("2026-11-29T05:30:00Z"),
    morning: resolve("Sat 28", "10:00").toISOString(),
    nextMonth: resolve("Tue 1", "09:30").toISOString(),
  })
);
