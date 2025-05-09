"use client";

import React, { useState, useRef } from "react";

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
    [day: string]: { start: number; end: number };
  };
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
}: EquipmentBookingGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isDragging = useRef(false);

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

    // Get the hour from the time (e.g., "09:00" -> 9)
    const hour = parseInt(time.split(":")[0], 10);

    // Check if the hour is outside the allowed range
    return (
      hour < level3Restrictions[fullDayName].start ||
      hour >= level3Restrictions[fullDayName].end
    );
  };

  // Generate day labels for the specified number of days
  const days = generateDateLabels(visibleDays);

  const times = generateTimeSlots(
    visibleTimeRange?.startHour ?? 0,
    visibleTimeRange?.endHour ?? 24
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

  const grid = (
    <div
      className="grid border border-gray-300 rounded text-xs"
      style={{
        gridTemplateColumns: "80px repeat(7, 120px)",
      }}
      onMouseDown={() => (isDragging.current = true)}
      onMouseUp={() => (isDragging.current = false)}
      onMouseLeave={() => (isDragging.current = false)}
    >
      {/* Empty top-left cell */}
      <div className="bg-white border-b border-r border-gray-300"></div>

      {/* Day headers */}
      {days.map((day) => {
        const dayParts = day.split(" ");
        const dayName = dayParts[0]; // e.g., "Thu"
        const dayNumber = parseInt(dayParts[1], 10); // e.g., 8
        const isToday =
          dayNumber === today &&
          dayName ===
            new Date().toLocaleDateString("en-US", { weekday: "short" });

        return (
          <div
            key={day}
            className={`text-center py-2 border-b border-r border-gray-300 ${
              isToday ? "bg-yellow-100 font-bold" : "bg-white"
            }`}
          >
            <div className="text-sm">{dayName}</div>
            <div className="text-xs">{dayNumber}</div>
          </div>
        );
      })}

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
          <React.Fragment key={time}>
            {/* Time label column */}
            <div
              className={`text-right pr-2 py-1 border-b border-r border-gray-300 bg-white ${
                showTime ? "font-medium" : ""
              }`}
            >
              {formattedTime}
            </div>

            {/* Slot cells */}
            {days.map((day) => {
              const slot = slotsByDay?.[day]?.[time] ?? {
                isAvailable: false,
                isBooked: false,
              };

              const isSelected = selectedSlots.some((slotStr) => {
                const [start] = slotStr.split("|");
                const slotDate = new Date(start);
                // Create the day string in the same format as our grid headers (e.g., "Thu 8")
                const slotDayStr = `${slotDate.toLocaleDateString("en-US", {
                  weekday: "short",
                })} ${slotDate.getDate()}`;
                const hours = slotDate.getHours().toString().padStart(2, "0");
                const minutes = slotDate
                  .getMinutes()
                  .toString()
                  .padStart(2, "0");
                const slotTimeStr = `${hours}:${minutes}`;

                return slotDayStr === day && slotTimeStr === time;
              });

              const isAdminRestricted = isRestrictedByAdmin(day, time);
              const baseStyle =
                "w-full h-6 border-b border-r border-gray-300 transition-all duration-100";
              const colorClass = slot?.reservedForWorkshop
                ? "bg-purple-400 cursor-not-allowed" // Reserved by workshop
                : slot?.isBooked
                ? slot?.bookedByMe
                  ? "bg-blue-400 cursor-not-allowed" // Booked by me
                  : "bg-red-400 cursor-not-allowed" // Booked by others
                : isAdminRestricted
                ? "bg-gray-300 cursor-not-allowed" // Restricted by admin
                : isSelected
                ? "bg-green-500"
                : slot?.isAvailable
                ? "bg-white hover:bg-green-200 cursor-pointer"
                : "bg-pink-100 cursor-not-allowed";

              return (
                <div
                  key={`${day}-${time}`}
                  className={`${baseStyle} ${colorClass} relative group`}
                  onClick={() =>
                    !isAdminRestricted && handleSlotToggle(day, time)
                  }
                  onMouseEnter={() =>
                    !isAdminRestricted &&
                    isDragging.current &&
                    handleSlotToggle(day, time)
                  }
                >
                  {isAdminRestricted && (
                    <div className="hidden group-hover:block absolute z-10 -mt-8 ml-6 px-2 py-1 bg-red-100 border border-red-200 rounded text-red-700 text-xs whitespace-nowrap">
                      Restricted by admin
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );

  if (disabled) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{grid}</div>
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
          {level3Restrictions && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-300 border border-gray-300" />
              <span>Admin Restricted</span>
            </div>
          )}
        </div>

        <p className="text-md font-medium mt-2">Click and Drag to Toggle</p>
      </div>

      {/* Grid Render */}
      {grid}
    </div>
  );
}
