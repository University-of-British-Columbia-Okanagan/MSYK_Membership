import { createPlugin } from "@fullcalendar/core";
import { NamedTimeZoneImpl } from "@fullcalendar/core/internal";
import {
  offsetMinutesForWallArray,
  wallArrayForTimestamp,
} from "~/utils/business-time";

// Without a named-zone plugin FullCalendar only knows "local" and "UTC", so
// "today" and every event time would follow the viewer's device clock.
class BusinessTimeZone extends NamedTimeZoneImpl {
  offsetForArray(a: number[]): number {
    return offsetMinutesForWallArray(a, this.timeZoneName);
  }

  timestampToArray(ms: number): number[] {
    return wallArrayForTimestamp(ms, this.timeZoneName);
  }
}

export const businessTimeZonePlugin = createPlugin({
  name: "business-time-zone",
  namedTimeZonedImpl: BusinessTimeZone,
});
