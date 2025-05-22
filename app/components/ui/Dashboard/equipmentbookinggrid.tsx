"use client";

import React, { useState, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Function to generate times in 30-minute increments between startHour and endHour
const generateTimeSlots = (startHour: number, endHour: number) => {
  const result: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    result.push(`${h.toString().padStart(2, "0")}:00`);
    result.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return result;
};

// Generate date-specific day labels (e.g., "Thu 8", "Fri 9", etc.)
const generateDateLabels = (visibleDays: number) => {
  const result: string[] = [];
  const today = new Date();

  for (let i = 0; i < visibleDays; i++) {
    const date = new Date();
    date.setDate(today.getDate() + i);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const dayNumber = date.getDate();
    result.push(`${dayName} ${dayNumber}`);
  }

  return result;
};

interface Slot {
  id: number | null;
  isBooked: boolean;
  isAvailable: boolean;
  workshopName?: string | null;
  bookedByMe?: boolean;
  reservedForWorkshop?: boolean;
}

interface SlotsByDay {
  [day: string]: {
    [time: string]: Slot;
  };
}
export type { SlotsByDay };

// interface EquipmentBookingGridProps {
//   slotsByDay: SlotsByDay;
//   onSelectSlots: (selectedSlots: string[]) => void;
//   disabled?: boolean;
//   visibleTimeRange?: { startHour: number; endHour: number }; // NEW
//   preselectedSlotIds?: number[];
// }
interface EquipmentBookingGridProps {
  slotsByDay: SlotsByDay;
  onSelectSlots: (selectedSlots: string[]) => void;
  disabled?: boolean;
  visibleTimeRange?: { startHour: number; endHour: number };
  preselectedSlotIds?: number[];
  visibleDays?: number; // NEW: Number of days to display
  level3Restrictions?: {
    [day: string]: { start: number; end: number; closed: boolean };
  };
  level4Restrictions?: {
    start: number;
    end: number;
  };
  plannedClosures?: Array<{
    // Add this new prop
    id: number;
    startDate: string | Date;
    endDate: string | Date;
  }>;
  userRoleLevel?: number;
}

// export default function EquipmentBookingGrid({
//   slotsByDay,
//   onSelectSlots,
//   disabled = false,
//   visibleTimeRange,
// }: EquipmentBookingGridProps) {
//   const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const isDragging = useRef(false);

//   const times = generateTimeSlots(
//     visibleTimeRange?.startHour ?? 0,
//     visibleTimeRange?.endHour ?? 24
//   );
export default function EquipmentBookingGrid({
  slotsByDay,
  onSelectSlots,
  disabled = false,
  visibleTimeRange,
  visibleDays = 7, // Default to 7 days if not specified
  level3Restrictions,
  level4Restrictions,
  plannedClosures = [],
  userRoleLevel,
}: EquipmentBookingGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isDragging = useRef(false);
  const [activeTab, setActiveTab] = useState("week-0");

  // Helper function to check if a slot is restricted by admin settings for level 3 users
  const isRestrictedByAdmin = (day: string, time: string): boolean => {
    if (!level3Restrictions) return false;

    // Get the day name (e.g., "Thu" from "Thu 8")
    const dayName = day.split(" ")[0];

    // Map short day names to full day names
    const dayNameMap: { [key: string]: string } = {
      Sun: "Sunday",
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
    };

    const fullDayName = dayNameMap[dayName];

    // If we don't have restrictions for this day, it's not restricted
    if (!level3Restrictions[fullDayName]) return false;

    // If the day is marked as closed, restrict all slots
    if (level3Restrictions[fullDayName].closed) return true;

    // Get the hour from the time (e.g., "09:00" -> 9)
    const hour = parseInt(time.split(":")[0], 10);

    // Check if the hour is outside the allowed range
    return (
      hour < level3Restrictions[fullDayName].start ||
      hour >= level3Restrictions[fullDayName].end
    );
  };

  const getLevel3TimeRange = () => {
    if (!level3Restrictions) {
      return visibleTimeRange ?? { startHour: 0, endHour: 24 };
    }

    // Find the earliest start hour and latest end hour across all days
    let earliestStart = 24; // Initialize to end of day
    let latestEnd = 0; // Initialize to beginning of day

    Object.values(level3Restrictions).forEach((restriction) => {
      // Skip closed days when calculating range
      if (restriction.closed !== true) {
        earliestStart = Math.min(earliestStart, restriction.start);
        latestEnd = Math.max(latestEnd, restriction.end);
      }
    });

    // If no valid time range found (all days closed), use default or visible time range
    if (earliestStart >= latestEnd) {
      return visibleTimeRange ?? { startHour: 0, endHour: 24 };
    }

    return { startHour: earliestStart, endHour: latestEnd };
  };

  // Helper function to check if a slot is restricted by admin settings for level 4 users
  const isLevel4Restricted = (day: string, time: string): boolean => {
    // If there are no restrictions or settings are 0,0 (no restrictions)
    if (
      !level4Restrictions ||
      (level4Restrictions.start === 0 && level4Restrictions.end === 0)
    ) {
      return false;
    }

    // Get the hour from the time (e.g., "09:00" -> 9)
    const hour = parseInt(time.split(":")[0], 10);

    // For restrictions that span overnight (e.g., 20 to 2)
    if (level4Restrictions.start > level4Restrictions.end) {
      return hour >= level4Restrictions.start || hour < level4Restrictions.end;
    }
    // For restrictions within the same day (e.g., 9 to 17)
    else {
      return hour >= level4Restrictions.start && hour < level4Restrictions.end;
    }
  };

  // Convert planned closures dates to Date objects if they're strings
  const normalizedPlannedClosures = useMemo(() => {
    return plannedClosures.map((closure) => ({
      id: closure.id,
      startDate:
        closure.startDate instanceof Date
          ? closure.startDate
          : new Date(closure.startDate),
      endDate:
        closure.endDate instanceof Date
          ? closure.endDate
          : new Date(closure.endDate),
    }));
  }, [plannedClosures]);

  // Add function to check if a slot is within a planned closure
  const isInPlannedClosure = (day: string, time: string): boolean => {
    if (!normalizedPlannedClosures.length || userRoleLevel !== 3) return false;

    // Extract day parts and create a date for the slot
    const dayParts = day.split(" ");
    const dayName = dayParts[0]; // e.g., "Thu"
    const dayNumber = parseInt(dayParts[1], 10); // e.g., 8

    const [hour, minute] = time.split(":").map(Number);

    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Create a date for the slot
    const slotDate = new Date(
      currentYear,
      currentMonth,
      dayNumber,
      hour,
      minute
    );

    // If the day is less than today's date and we're near the end of the month,
    // it probably means we're booking for the next month
    if (dayNumber < now.getDate() && now.getDate() > 20) {
      slotDate.setMonth(currentMonth + 1);
    }

    // Check if the slot date falls within any planned closure
    return normalizedPlannedClosures.some((closure) => {
      return slotDate >= closure.startDate && slotDate < closure.endDate;
    });
  };

  // Generate day labels for all visible days
  const allDays = generateDateLabels(visibleDays);

  // Calculate how many weeks we need to display
  const totalWeeks = Math.ceil(visibleDays / 7);

  // Organize days into weeks
  const weekDays: string[][] = [];
  for (let i = 0; i < totalWeeks; i++) {
    weekDays.push(allDays.slice(i * 7, (i + 1) * 7));
  }

  // const times = generateTimeSlots(
  //   visibleTimeRange?.startHour ?? 0,
  //   visibleTimeRange?.endHour ?? 24
  // );
  const level3TimeRange = getLevel3TimeRange();
  const times = generateTimeSlots(
    userRoleLevel === 3
      ? level3TimeRange.startHour
      : visibleTimeRange?.startHour ?? 0,
    userRoleLevel === 3
      ? level3TimeRange.endHour
      : visibleTimeRange?.endHour ?? 24
  );

  const handleSlotToggle = (day: string, time: string) => {
    if (disabled) return;

    const slot = slotsByDay?.[day]?.[time];
    if (!slot?.isAvailable || slot?.isBooked) {
      setErrorMessage("This slot is already booked or unavailable.");
      return;
    }

    // Extract day parts (e.g., "Thu 8" -> "Thu" and "8")
    const dayParts = day.split(" ");
    const dayName = dayParts[0]; // e.g., "Thu"
    const dayNumber = parseInt(dayParts[1], 10); // e.g., 8

    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Create date for the selected day
    const [hour, minute] = time.split(":").map(Number);

    // Start by using the current month and year
    const startTime = new Date(
      currentYear,
      currentMonth,
      dayNumber,
      hour,
      minute,
      0,
      0
    );

    // If the day is less than today's date and we're near the end of the month,
    // it probably means we're booking for the next month
    if (dayNumber < now.getDate() && now.getDate() > 20) {
      startTime.setMonth(currentMonth + 1);
    }

    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    const slotString = `${startTime.toISOString()}|${endTime.toISOString()}`;

    const isAlreadySelected = selectedSlots.includes(slotString);

    // Count current day and total week slot selections
    const slotsPerDay: { [day: string]: number } = {};
    let totalSlots = 0;

    for (const s of selectedSlots) {
      const [start] = s.split("|");
      const slotDate = new Date(start);
      // Use the same day format (e.g., "Thu 8") for consistency
      const d = `${slotDate.toLocaleDateString("en-US", {
        weekday: "short",
      })} ${slotDate.getDate()}`;
      slotsPerDay[d] = (slotsPerDay[d] || 0) + 1;
      totalSlots += 1;
    }

    const currentDayCount = slotsPerDay[day] || 0;
    const newDayCount = isAlreadySelected
      ? currentDayCount - 1
      : currentDayCount + 1;
    const newWeekCount = isAlreadySelected ? totalSlots - 1 : totalSlots + 1;

    if (!isAlreadySelected && newDayCount > 4) {
      setErrorMessage("You can only select up to 2 hours (4 slots) per day.");
      return;
    }

    // Check week limit based on the first day of selection
    // Get the first day of the selection period
    let firstDate: Date | null = null;

    if (selectedSlots.length > 0) {
      // Get the earliest date from existing selections
      for (const s of selectedSlots) {
        const [start] = s.split("|");
        const date = new Date(start);
        if (!firstDate || date < firstDate) {
          firstDate = date;
        }
      }
    }

    // If this is the first selection, use this slot's date
    if (!firstDate) {
      firstDate = startTime;
    }

    // Check if the current selection is within 7 days of the first selection
    const sevenDaysLater = new Date(firstDate);
    sevenDaysLater.setDate(firstDate.getDate() + 7);

    if (startTime > sevenDaysLater) {
      setErrorMessage(
        "All bookings must be within a 7-day period from your first selection."
      );
      return;
    }

    if (!isAlreadySelected && newWeekCount > 14) {
      setErrorMessage("You can only select up to 7 hours (14 slots) per week.");
      return;
    }

    setErrorMessage(null);

    const updatedSlots = isAlreadySelected
      ? selectedSlots.filter((s) => s !== slotString)
      : [...selectedSlots, slotString];

    setSelectedSlots(updatedSlots);
    onSelectSlots(updatedSlots);
  };

  const today = new Date().getDate();

  // Render a single week grid
  const renderWeekGrid = (days: string[]) => {
    return (
      <table className="border-collapse border border-gray-300 text-xs w-full">
        <thead>
          <tr>
            {/* Empty header cell for time column */}
            <th className="border border-gray-300 bg-white w-20"></th>

            {/* Day headers for this week */}
            {days.map((day) => {
              const dayParts = day.split(" ");
              const dayName = dayParts[0]; // e.g., "Thu"
              const dayNumber = parseInt(dayParts[1], 10); // e.g., 8
              const isToday =
                dayNumber === today &&
                dayName ===
                  new Date().toLocaleDateString("en-US", {
                    weekday: "short",
                  });

              return (
                <th
                  key={day}
                  className={`border border-gray-300 p-2 text-center ${
                    isToday ? "bg-yellow-100 font-bold" : "bg-white"
                  }`}
                >
                  <div className="text-sm">{dayName}</div>
                  <div className="text-xs">{dayNumber}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Time rows */}
          {times.map((time) => {
            const showTime = time.endsWith("00");
            const [hour] = time.split(":");
            const displayHour = Number(hour);
            const formattedTime = showTime
              ? displayHour === 0
                ? "12:00 AM"
                : displayHour === 12
                ? "12:00 PM"
                : `${displayHour % 12}:00 ${displayHour < 12 ? "AM" : "PM"}`
              : "";

            return (
              <tr key={time}>
                {/* Time label column */}
                <td
                  className={`text-right pr-2 py-1 border border-gray-300 bg-white ${
                    showTime ? "font-medium" : ""
                  }`}
                >
                  {formattedTime}
                </td>

                {/* Slot cells for this row of days */}
                {days.map((day) => {
                  const slot = slotsByDay?.[day]?.[time] ?? {
                    isAvailable: false,
                    isBooked: false,
                  };

                  const isSelected = selectedSlots.some((slotStr) => {
                    const [start] = slotStr.split("|");
                    const slotDate = new Date(start);
                    const slotDayStr = `${slotDate.toLocaleDateString("en-US", {
                      weekday: "short",
                    })} ${slotDate.getDate()}`;
                    const hours = slotDate
                      .getHours()
                      .toString()
                      .padStart(2, "0");
                    const minutes = slotDate
                      .getMinutes()
                      .toString()
                      .padStart(2, "0");
                    const slotTimeStr = `${hours}:${minutes}`;

                    return slotDayStr === day && slotTimeStr === time;
                  });

                  const isAdminRestricted =
                    userRoleLevel === 3
                      ? isRestrictedByAdmin(day, time)
                      : false;
                  const isLevel4AdminRestricted =
                    userRoleLevel === 4 ? isLevel4Restricted(day, time) : false;
                  const isAnyRestriction =
                    isAdminRestricted || isLevel4AdminRestricted;

                  const isPlannedClosure =
                    userRoleLevel === 3 && isInPlannedClosure(day, time);
                  const colorClass = slot?.reservedForWorkshop
                    ? "bg-purple-400 cursor-not-allowed" // Reserved by workshop
                    : slot?.isBooked
                    ? slot?.bookedByMe
                      ? "bg-blue-400 cursor-not-allowed" // Booked by me
                      : "bg-red-400 cursor-not-allowed" // Booked by others
                    : isPlannedClosure
                    ? "bg-orange-300 cursor-not-allowed" // Planned closure (new color)
                    : isAnyRestriction
                    ? "bg-gray-300 cursor-not-allowed" // Restricted by admin
                    : isSelected
                    ? "bg-green-500"
                    : slot?.isAvailable
                    ? "bg-white hover:bg-green-200 cursor-pointer"
                    : "bg-pink-100 cursor-not-allowed";

                  return (
                    <td
                      key={`${day}-${time}`}
                      className={`border border-gray-300 h-6 relative group ${colorClass}`}
                      onClick={() =>
                        !isAnyRestriction &&
                        !isPlannedClosure &&
                        handleSlotToggle(day, time)
                      }
                      onMouseEnter={() =>
                        !isAnyRestriction &&
                        !isPlannedClosure &&
                        isDragging.current &&
                        handleSlotToggle(day, time)
                      }
                    >
                      {isAnyRestriction && (
                        <div className="hidden group-hover:block absolute z-10 -mt-8 ml-6 px-2 py-1 bg-red-100 border border-red-200 rounded text-red-700 text-xs whitespace-nowrap">
                          Restricted by admin
                        </div>
                      )}
                      {isPlannedClosure && (
                        <div className="hidden group-hover:block absolute z-10 -mt-8 ml-6 px-2 py-1 bg-orange-100 border border-orange-200 rounded text-orange-700 text-xs whitespace-nowrap">
                          Planned closure
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // Render all week tabs
  const renderWeekTabs = () => {
    // Generate tab labels like "May 22-28"
    const getTabLabel = (weekIndex: number, days: string[]) => {
      if (days.length === 0) return `Week ${weekIndex + 1}`;

      const firstDay = days[0].split(" ")[1];
      const lastDay = days[days.length - 1].split(" ")[1];

      // Get month names
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Find the month for the first day
      let firstDayMonth = currentMonth;
      if (parseInt(firstDay) < today.getDate() && today.getDate() > 20) {
        firstDayMonth = (currentMonth + 1) % 12;
      }

      const firstMonthName = new Date(
        currentYear,
        firstDayMonth,
        1
      ).toLocaleString("default", { month: "short" });

      return `${firstMonthName} ${firstDay}-${lastDay}`;
    };

    return (
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b mb-4">
            <TabsList className="bg-transparent h-auto p-0 mb-0 flex w-full justify-start overflow-x-auto">
              {weekDays.map((days, index) => (
                <TabsTrigger
                  key={`week-${index}`}
                  value={`week-${index}`}
                  className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none"
                >
                  {getTabLabel(index, days)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {weekDays.map((days, index) => (
            <TabsContent
              key={`week-content-${index}`}
              value={`week-${index}`}
              className="mt-0 p-0"
            >
              {renderWeekGrid(days)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  };

  if (disabled) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{renderWeekTabs()}</div>
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white bg-opacity-90 p-6 border border-red-300 text-red-600 rounded shadow-md text-center max-w-md">
            <p className="text-md font-semibold">
              🚫 You do not have the required membership to book equipment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto">
      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 text-red-500 bg-red-100 p-3 rounded border border-red-400 text-sm text-center">
          {errorMessage}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center gap-4 justify-center mb-2 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-pink-100 border border-gray-300" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 border border-gray-300" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-white border border-gray-300" />
            <span>Unselected</span>
          </div>
        </div>
        <div className="flex items-center gap-4 justify-center text-sm">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-400 border border-gray-300" />
            <span>Booked by You</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-400 border border-gray-300" />
            <span>Booked by Others</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-400 border border-gray-300" />
            <span>Reserved for Workshop</span>
          </div>
          {(level3Restrictions || level4Restrictions) && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-300 border border-gray-300" />
              <span>Admin Restricted</span>
            </div>
          )}
        </div>

        <p className="text-md font-medium mt-2">Click and Drag to Toggle</p>
      </div>

      {/* Week Tabs */}
      {renderWeekTabs()}
    </div>
  );
}
