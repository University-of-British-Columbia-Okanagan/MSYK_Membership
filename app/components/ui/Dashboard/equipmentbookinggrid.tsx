import { useState, useRef, useMemo } from "react";
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

interface EquipmentBookingGridProps {
  slotsByDay: SlotsByDay;
  onSelectSlots: (selectedSlots: string[]) => void;
  disabled?: boolean;
  disabledMessage?: string;
  readOnly?: boolean;
  visibleTimeRange?: { startHour: number; endHour: number };
  preselectedSlotIds?: number[];
  visibleDays?: number;
  level3Restrictions?: {
    [day: string]: { start: number; end: number; closed: boolean };
  };
  level4Restrictions?: {
    start: number;
    end: number;
  };
  plannedClosures?: Array<{
    id: number;
    startDate: string | Date;
    endDate: string | Date;
  }>;
  userRoleLevel?: number;
  workshopSlots?: { [day: string]: string[] };
  currentWorkshopOccurrences?: { startDate: Date; endDate: Date }[];
  maxSlotsPerDay?: number;
  maxSlotsPerWeek?: number;
  currentWorkshopId?: number;
  currentWorkshopName?: string;
}

export default function EquipmentBookingGrid({
  slotsByDay,
  onSelectSlots,
  disabled = false,
  readOnly = false,
  visibleTimeRange,
  disabledMessage = "Booking is currently disabled.",
  visibleDays = 7, // Default to 7 days if not specified
  level3Restrictions,
  level4Restrictions,
  plannedClosures = [],
  userRoleLevel,
  workshopSlots,
  currentWorkshopOccurrences,
  maxSlotsPerDay = 4, // in slots (each slot = 30 minutes)
  maxSlotsPerWeek = 14, // in slots (each slot = 30 minutes)
  currentWorkshopId,
  currentWorkshopName,
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

  const isSlotInPast = (day: string, time: string): boolean => {
    const now = new Date();

    // Extract day parts
    const dayParts = day.split(" ");
    const dayName = dayParts[0]; // e.g., "Thu"
    const dayNumber = parseInt(dayParts[1], 10); // e.g., 8

    // Extract time parts
    const [hour, minute] = time.split(":").map(Number);

    // Create a date for the slot
    const slotDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      dayNumber,
      hour,
      minute
    );

    // If the day is less than today's date and we're near the end of the month,
    // it probably means we're booking for the next month
    if (dayNumber < now.getDate() && now.getDate() > 20) {
      slotDate.setMonth(now.getMonth() + 1);
    }

    // Check if the slot is in the past
    return slotDate < now;
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
    if (disabled || readOnly) return;

    if (isSlotInPast(day, time)) {
      setErrorMessage("Cannot book slots in the past.");
      return;
    }

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

    // maxSlotsPerDay is already in slots, no conversion needed
    const maxSlotsAllowed = maxSlotsPerDay;
    if (!isAlreadySelected && newDayCount > maxSlotsAllowed) {
      const hours = (maxSlotsPerDay * 30) / 60; // Convert slots to hours for display
      setErrorMessage(
        `You can only select up to ${hours} hours (${maxSlotsAllowed} slots) per day.`
      );
      return;
    }

    {
      /* OLD 7-day period from first booking */
    }
    // Maximum slots allowed per 7-day period is always 14
    // const maxSlotsPerWeek = 14;
    // // Check week limit based on the first day of selection
    // // Get the first day of the selection period, including already booked slots
    // let firstDate: Date | null = null;
    // let totalBookedSlots = 0;
    // // First, check existing booked slots by the user to find the earliest booking
    // const allDays = Object.keys(slotsByDay);
    // for (const day of allDays) {
    //   const daySlots = slotsByDay[day];
    //   for (const time of Object.keys(daySlots)) {
    //     const slot = daySlots[time];
    //     if (slot?.bookedByMe) {
    //       // Extract day parts and create a date for this booked slot
    //       const dayParts = day.split(" ");
    //       const dayNumber = parseInt(dayParts[1], 10);
    //       const [hour, minute] = time.split(":").map(Number);
    //       // Create date for this booked slot
    //       const now = new Date();
    //       const bookedSlotDate = new Date(
    //         now.getFullYear(),
    //         now.getMonth(),
    //         dayNumber,
    //         hour,
    //         minute
    //       );

    //       // Adjust month if day is in next month
    //       if (dayNumber < now.getDate() && now.getDate() > 20) {
    //         bookedSlotDate.setMonth(bookedSlotDate.getMonth() + 1);
    //       }

    //       if (!firstDate || bookedSlotDate < firstDate) {
    //         firstDate = bookedSlotDate;
    //       }
    //     }
    //   }
    // }
    // // Then check current session selections
    // if (selectedSlots.length > 0) {
    //   // Get the earliest date from current selections
    //   for (const s of selectedSlots) {
    //     const [start] = s.split("|");
    //     const date = new Date(start);
    //     if (!firstDate || date < firstDate) {
    //       firstDate = date;
    //     }
    //   }
    // }
    // // If this is the first selection, use this slot's date
    // if (!firstDate) {
    //   firstDate = startTime;
    // }
    // // Check if the current selection is within 7 days of the first selection
    // const sevenDaysLater = new Date(firstDate.getTime());
    // sevenDaysLater.setDate(firstDate.getDate() + 7);
    // if (startTime >= sevenDaysLater) {
    //   // Starting a new 7-day period - need to find the earliest selection in the new period
    //   // Check if there are any current selections and find the earliest one
    //   let earliestNewSelection = startTime;
    //   for (const s of selectedSlots) {
    //     const [start] = s.split("|");
    //     const date = new Date(start);
    //     if (date < earliestNewSelection) {
    //       earliestNewSelection = date;
    //     }
    //   }
    //   // Set firstDate to the earliest selection (either existing selections or current slot)
    //   firstDate = earliestNewSelection;
    //   // Recalculate the 7-day window from the new starting point
    //   sevenDaysLater.setTime(firstDate.getTime());
    //   sevenDaysLater.setDate(firstDate.getDate() + 7);
    //   // Reset totalBookedSlots to 0 since we're starting a new period
    //   totalBookedSlots = 0;
    // }
    // // Count all slots within the 7-day period (both booked and selected)
    // // Reset totalBookedSlots and count again for the current period
    // totalBookedSlots = 0;
    // if (firstDate) {
    //   const sevenDaysFromFirst = new Date(firstDate.getTime());
    //   sevenDaysFromFirst.setDate(firstDate.getDate() + 7);

    //   // Count existing booked slots within the 7-day period
    //   for (const day of allDays) {
    //     const daySlots = slotsByDay[day];
    //     for (const time of Object.keys(daySlots)) {
    //       const slot = daySlots[time];
    //       if (slot?.bookedByMe) {
    //         // Create date for this booked slot
    //         const dayParts = day.split(" ");
    //         const dayNumber = parseInt(dayParts[1], 10);
    //         const [hour, minute] = time.split(":").map(Number);
    //         const now = new Date();
    //         const bookedSlotDate = new Date(
    //           now.getFullYear(),
    //           now.getMonth(),
    //           dayNumber,
    //           hour,
    //           minute
    //         );
    //         // Adjust month if day is in next month
    //         if (dayNumber < now.getDate() && now.getDate() > 20) {
    //           bookedSlotDate.setMonth(bookedSlotDate.getMonth() + 1);
    //         }
    //         // Check if this booked slot is within the 7-day period
    //         if (
    //           bookedSlotDate >= firstDate &&
    //           bookedSlotDate < sevenDaysFromFirst
    //         ) {
    //           totalBookedSlots++;
    //         }
    //       }
    //     }
    //   }
    // }
    // // Check if adding this slot would exceed the weekly limit
    // const totalSlotsIncludingNew = totalBookedSlots + newWeekCount;
    // if (!isAlreadySelected && totalSlotsIncludingNew > maxSlotsPerWeek) {
    //   const firstDateStr = firstDate.toLocaleDateString("en-US", {
    //     month: "short",
    //     day: "numeric",
    //     year: "numeric",
    //   });
    //   const endDateStr = new Date(
    //     sevenDaysLater.getTime() - 1
    //   ).toLocaleDateString("en-US", {
    //     month: "short",
    //     day: "numeric",
    //     year: "numeric",
    //   });
    //   // Count selected slots that are actually within this 7-day period
    //   let selectedSlotsInPeriod = 0;
    //   for (const s of selectedSlots) {
    //     const [start] = s.split("|");
    //     const slotDate = new Date(start);
    //     const sevenDaysFromFirst = new Date(firstDate.getTime());
    //     sevenDaysFromFirst.setDate(firstDate.getDate() + 7);

    //     if (slotDate >= firstDate && slotDate < sevenDaysFromFirst) {
    //       selectedSlotsInPeriod++;
    //     }
    //   }
    //   setErrorMessage(
    //     `You can only select up to 7 hours (14 slots) within a 7-day period (${firstDateStr} - ${endDateStr}). You currently have ${totalBookedSlots} booked slots and ${selectedSlotsInPeriod} selected slots in this period.`
    //   );
    //   return;
    // }

    {
      /* Sliding 7-day periods approach */
    }
    // // Check sliding 7-day period limits - each day creates a new 7-day period
    // if (!isAlreadySelected) {
    //   // Helper function to create date from day and time
    //   const createDateFromDayTime = (day: string, time: string): Date => {
    //     const dayParts = day.split(" ");
    //     const dayNumber = parseInt(dayParts[1], 10);
    //     const [hour, minute] = time.split(":").map(Number);

    //     const now = new Date();
    //     const date = new Date(
    //       now.getFullYear(),
    //       now.getMonth(),
    //       dayNumber,
    //       hour,
    //       minute
    //     );

    //     // Adjust month if day is in next month
    //     if (dayNumber < now.getDate() && now.getDate() > 20) {
    //       date.setMonth(date.getMonth() + 1);
    //     }

    //     return date;
    //   };

    //   // Get all unique dates from the grid
    //   const allDays = Object.keys(slotsByDay);
    //   const allGridDates: Date[] = [];

    //   for (const day of allDays) {
    //     const dayParts = day.split(" ");
    //     const dayNumber = parseInt(dayParts[1], 10);
    //     const now = new Date();
    //     const date = new Date(
    //       now.getFullYear(),
    //       now.getMonth(),
    //       dayNumber,
    //       0,
    //       0,
    //       0,
    //       0
    //     );

    //     // Adjust month if day is in next month
    //     if (dayNumber < now.getDate() && now.getDate() > 20) {
    //       date.setMonth(date.getMonth() + 1);
    //     }

    //     allGridDates.push(date);
    //   }

    //   // Sort dates and remove duplicates
    //   const uniqueDates = Array.from(
    //     new Set(allGridDates.map((d) => d.toDateString()))
    //   )
    //     .map((dateStr) => new Date(dateStr))
    //     .sort((a, b) => a.getTime() - b.getTime());

    //   // Check ALL possible 7-day periods that could contain this slot
    //   // Each day can be the start of a 7-day period
    //   // Get all dates that have actual bookings or selections
    //   const datesWithBookings = new Set<string>();

    //   // Add dates from existing bookings
    //   for (const day of allDays) {
    //     const daySlots = slotsByDay[day];
    //     for (const time of Object.keys(daySlots)) {
    //       const slot = daySlots[time];
    //       if (slot?.bookedByMe) { // This checks ALL bookings by you even in the past
    //         const slotDate = createDateFromDayTime(day, time);
    //         const dateOnly = new Date(slotDate);
    //         dateOnly.setHours(0, 0, 0, 0);
    //         datesWithBookings.add(dateOnly.toDateString());
    //       }
    //     }
    //   }

    //   // Add dates from current selections
    //   for (const s of selectedSlots) {
    //     const [start] = s.split("|");
    //     const slotDate = new Date(start);
    //     const dateOnly = new Date(slotDate);
    //     dateOnly.setHours(0, 0, 0, 0);
    //     datesWithBookings.add(dateOnly.toDateString());
    //   }

    //   // Add the current slot date
    //   const currentSlotDateOnly = new Date(startTime);
    //   currentSlotDateOnly.setHours(0, 0, 0, 0);
    //   datesWithBookings.add(currentSlotDateOnly.toDateString());

    //   // Convert back to Date objects and sort
    //   const relevantDates = Array.from(datesWithBookings)
    //     .map((dateStr) => new Date(dateStr))
    //     .sort((a, b) => a.getTime() - b.getTime());

    //   // Check periods that start from any date that has bookings/selections
    //   // and could contain the current slot
    //   for (const periodStartDate of relevantDates) {
    //     const periodStart = new Date(periodStartDate);
    //     periodStart.setHours(0, 0, 0, 0);

    //     const periodEnd = new Date(periodStart);
    //     periodEnd.setDate(periodStart.getDate() + 7);
    //     periodEnd.setHours(0, 0, 0, 0);

    //     // Check if the current slot falls within this 7-day period
    //     if (
    //       currentSlotDateOnly >= periodStart &&
    //       currentSlotDateOnly < periodEnd
    //     ) {
    //       let totalSlotsInPeriod = 0;

    //       // Count existing booked slots in this 7-day period
    //       for (const day of allDays) {
    //         const daySlots = slotsByDay[day];
    //         for (const time of Object.keys(daySlots)) {
    //           const slot = daySlots[time];
    //           if (slot?.bookedByMe) { // This checks ALL bookings by you even in the past
    //             const slotDate = createDateFromDayTime(day, time);
    //             const slotDateOnly = new Date(slotDate);
    //             slotDateOnly.setHours(0, 0, 0, 0);

    //             if (slotDateOnly >= periodStart && slotDateOnly < periodEnd) {
    //               totalSlotsInPeriod++;
    //             }
    //           }
    //         }
    //       }

    //       // Count current session selections in this 7-day period
    //       for (const s of selectedSlots) {
    //         const [start] = s.split("|");
    //         const slotDate = new Date(start);
    //         const slotDateOnly = new Date(slotDate);
    //         slotDateOnly.setHours(0, 0, 0, 0);

    //         if (slotDateOnly >= periodStart && slotDateOnly < periodEnd) {
    //           totalSlotsInPeriod++;
    //         }
    //       }

    //       // Check if adding this slot would exceed the limit for THIS period
    //       if (totalSlotsInPeriod + 1 > maxSlotsPerWeek) {
    //         const periodStartStr = periodStart.toLocaleDateString("en-US", {
    //           month: "short",
    //           day: "numeric",
    //           year: "numeric",
    //         });
    //         const periodEndDate = new Date(
    //           periodEnd.getTime() - 24 * 60 * 60 * 1000
    //         ); // Get the last day of the period
    //         const periodEndStr = periodEndDate.toLocaleDateString("en-US", {
    //           month: "short",
    //           day: "numeric",
    //           year: "numeric",
    //         });

    //         const hoursLimit = (maxSlotsPerWeek * 30) / 60; // Convert slots to hours
    //         setErrorMessage(
    //           `You can only select up to ${hoursLimit} hours (${maxSlotsPerWeek} slots) within any 7-day period. Period ${periodStartStr} - ${periodEndStr} would have ${
    //             totalSlotsInPeriod + 1
    //           } slots if you add this selection.`
    //         );
    //         return;
    //       }
    //     }
    //   }
    // }

    {
      /* Sliding 7-day periods approach including dates starting a week before first visible day in grid*/
    }
    // Check sliding 7-day period limits - each day creates a new 7-day period
    if (!isAlreadySelected) {
      // Helper function to create date from day and time
      const createDateFromDayTime = (day: string, time: string): Date => {
        const dayParts = day.split(" ");
        const dayNumber = parseInt(dayParts[1], 10);
        const [hour, minute] = time.split(":").map(Number);

        const now = new Date();
        const date = new Date(
          now.getFullYear(),
          now.getMonth(),
          dayNumber,
          hour,
          minute
        );

        // Adjust month if day is in next month
        if (dayNumber < now.getDate() && now.getDate() > 20) {
          date.setMonth(date.getMonth() + 1);
        }

        return date;
      };

      // Get all dates from the grid PLUS a week before the first visible date
      const allDaysFromGrid = Object.keys(slotsByDay);
      const allGridDates: Date[] = [];

      // First, get all visible dates from the grid
      for (const day of allDaysFromGrid) {
        const dayParts = day.split(" ");
        const dayNumber = parseInt(dayParts[1], 10);
        const now = new Date();
        const date = new Date(
          now.getFullYear(),
          now.getMonth(),
          dayNumber,
          0,
          0,
          0,
          0
        );

        // Adjust month if day is in next month
        if (dayNumber < now.getDate() && now.getDate() > 20) {
          date.setMonth(date.getMonth() + 1);
        }

        allGridDates.push(date);
      }

      // Find the first visible date
      const sortedGridDates = allGridDates.sort(
        (a, b) => a.getTime() - b.getTime()
      );
      const firstVisibleDate = sortedGridDates[0];

      // Add 7 days before the first visible date to capture previous bookings
      if (firstVisibleDate) {
        for (let i = 1; i <= 7; i++) {
          const earlierDate = new Date(firstVisibleDate);
          earlierDate.setDate(firstVisibleDate.getDate() - i);
          allGridDates.push(earlierDate);
        }
      }

      // Sort dates and remove duplicates
      const uniqueDates = Array.from(
        new Set(allGridDates.map((d) => d.toDateString()))
      )
        .map((dateStr) => new Date(dateStr))
        .sort((a, b) => a.getTime() - b.getTime());

      // Update allDays to include the expanded date range for booking checks
      const allDays = [...allDaysFromGrid]; // Keep original grid days for slot checking

      // Check ALL possible 7-day periods that could contain this slot
      // Each day can be the start of a 7-day period
      // Get all dates that have actual bookings or selections
      const datesWithBookings = new Set<string>();

      // Add dates from existing bookings (check both visible grid and expanded date range)
      for (const day of allDaysFromGrid) {
        const daySlots = slotsByDay[day];
        for (const time of Object.keys(daySlots)) {
          const slot = daySlots[time];
          if (slot?.bookedByMe) {
            // This checks ALL bookings by you even in the past
            const slotDate = createDateFromDayTime(day, time);
            const dateOnly = new Date(slotDate);
            dateOnly.setHours(0, 0, 0, 0);
            datesWithBookings.add(dateOnly.toDateString());
          }
        }
      }

      // Add dates from current selections
      for (const s of selectedSlots) {
        const [start] = s.split("|");
        const slotDate = new Date(start);
        const dateOnly = new Date(slotDate);
        dateOnly.setHours(0, 0, 0, 0);
        datesWithBookings.add(dateOnly.toDateString());
      }

      // Add the current slot date
      const currentSlotDateOnly = new Date(startTime);
      currentSlotDateOnly.setHours(0, 0, 0, 0);
      datesWithBookings.add(currentSlotDateOnly.toDateString());

      // Convert back to Date objects and sort
      const relevantDates = Array.from(datesWithBookings)
        .map((dateStr) => new Date(dateStr))
        .sort((a, b) => a.getTime() - b.getTime());

      // Check periods that start from any date that has bookings/selections
      // and could contain the current slot
      for (const periodStartDate of relevantDates) {
        const periodStart = new Date(periodStartDate);
        periodStart.setHours(0, 0, 0, 0);

        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 7);
        periodEnd.setHours(0, 0, 0, 0);

        // Check if the current slot falls within this 7-day period
        if (
          currentSlotDateOnly >= periodStart &&
          currentSlotDateOnly < periodEnd
        ) {
          let totalSlotsInPeriod = 0;

          // Count existing booked slots in this 7-day period (check all visible days)
          for (const day of allDaysFromGrid) {
            const daySlots = slotsByDay[day];
            for (const time of Object.keys(daySlots)) {
              const slot = daySlots[time];
              if (slot?.bookedByMe) {
                // This checks ALL bookings by you even in the past
                const slotDate = createDateFromDayTime(day, time);
                const slotDateOnly = new Date(slotDate);
                slotDateOnly.setHours(0, 0, 0, 0);

                if (slotDateOnly >= periodStart && slotDateOnly < periodEnd) {
                  totalSlotsInPeriod++;
                }
              }
            }
          }

          // Count current session selections in this 7-day period
          for (const s of selectedSlots) {
            const [start] = s.split("|");
            const slotDate = new Date(start);
            const slotDateOnly = new Date(slotDate);
            slotDateOnly.setHours(0, 0, 0, 0);

            if (slotDateOnly >= periodStart && slotDateOnly < periodEnd) {
              totalSlotsInPeriod++;
            }
          }

          // Check if adding this slot would exceed the limit for THIS period
          if (totalSlotsInPeriod + 1 > maxSlotsPerWeek) {
            const periodStartStr = periodStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const periodEndDate = new Date(
              periodEnd.getTime() - 24 * 60 * 60 * 1000
            ); // Get the last day of the period
            const periodEndStr = periodEndDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            const hoursLimit = (maxSlotsPerWeek * 30) / 60; // Convert slots to hours
            setErrorMessage(
              `You can only select up to ${hoursLimit} hours (${maxSlotsPerWeek} slots) within any 7-day period. Period ${periodStartStr} - ${periodEndStr} would have ${
                totalSlotsInPeriod + 1
              } slots if you add this selection.`
            );
            return;
          }
        }
      }
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
      <table className="border-collapse border border-gray-300 text-xs w-full table-fixed">
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
                  className={`border border-gray-300 px-1 py-0.5 text-center w-24 ${
                    isToday ? "bg-yellow-100 font-bold" : "bg-white"
                  }`}
                >
                  <div className="text-xs leading-tight">{dayName}</div>
                  <div className="text-xs leading-tight">{dayNumber}</div>
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
                {/* Time label column most important for height */}
                <td
                  className={`text-center border border-gray-300 bg-white text-xs h-4 ${
                    showTime ? "font-medium" : ""
                  }`}
                >
                  <div className="h-4 flex items-center justify-center text-xs">
                    {formattedTime}
                  </div>
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

                  const isWorkshopSlot =
                    workshopSlots &&
                    workshopSlots[day] &&
                    workshopSlots[day].includes(time);

                  // Check if this slot is part of the current workshop occurrences
                  const isCurrentWorkshopSlot =
                    currentWorkshopOccurrences?.length
                      ? currentWorkshopOccurrences.some((occ) => {
                          if (
                            isNaN(occ.startDate.getTime()) ||
                            isNaN(occ.endDate.getTime())
                          ) {
                            return false;
                          }

                          // Extract day parts
                          const dayParts = day.split(" ");
                          if (dayParts.length !== 2) return false;

                          const dayNumber = parseInt(dayParts[1], 10);

                          // Parse time
                          const [hour, minute] = time.split(":").map(Number);

                          // Create a date object for this slot
                          const now = new Date();
                          const slotDate = new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            dayNumber,
                            hour,
                            minute
                          );

                          // Adjust month if day is in next month
                          if (dayNumber < now.getDate() && now.getDate() > 20) {
                            slotDate.setMonth(slotDate.getMonth() + 1);
                          }

                          return (
                            slotDate >= occ.startDate && slotDate < occ.endDate
                          );
                        })
                      : false;

                  // Check if this slot is reserved for the current workshop being edited
                  const isCurrentWorkshopEditingSlot =
                    currentWorkshopId &&
                    slot?.reservedForWorkshop &&
                    // Check by workshop name
                    ((currentWorkshopName &&
                      slot.workshopName === currentWorkshopName) ||
                      // Check by occurrence ID if available
                      (slot as any).workshopOccurrenceId);

                  const isOtherWorkshopSlot =
                    (isWorkshopSlot || slot?.reservedForWorkshop) &&
                    !isCurrentWorkshopSlot &&
                    !isCurrentWorkshopEditingSlot;

                  const isPastSlot = isSlotInPast(day, time);

                  const colorClass = isCurrentWorkshopSlot
                    ? "bg-green-500 cursor-not-allowed" // Green for current workshop slots
                    : isCurrentWorkshopEditingSlot
                    ? "bg-yellow-400 cursor-not-allowed" // Yellow for slots being edited
                    : isOtherWorkshopSlot
                    ? "bg-purple-400 cursor-not-allowed" // Reserved by another workshop
                    : slot?.isBooked
                    ? slot?.bookedByMe
                      ? "bg-blue-400 cursor-not-allowed" // Booked by me
                      : "bg-red-400 cursor-not-allowed" // Booked by others
                    : isPlannedClosure
                    ? "bg-orange-300 cursor-not-allowed" // Planned closure
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
                      className={`border border-gray-300 h-3 relative group ${colorClass}`}
                      onClick={() =>
                        !isAnyRestriction &&
                        !isPlannedClosure &&
                        !isPastSlot && // Add check for past slots
                        !readOnly &&
                        handleSlotToggle(day, time)
                      }
                      onMouseEnter={() =>
                        !isAnyRestriction &&
                        !isPlannedClosure &&
                        !isPastSlot && // Add check for past slots
                        !readOnly &&
                        isDragging.current &&
                        handleSlotToggle(day, time)
                      }
                    >
                      {/* One tooltip shows at a time based on priority (admin restrictions > planned closures > 
                      workshop reservations > past slots) */}
                      {isAnyRestriction && (
                        <div className="hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-red-100 border border-red-200 rounded text-red-700 text-xs whitespace-nowrap shadow-lg">
                          Restricted by admin
                        </div>
                      )}
                      {isPlannedClosure && !isAnyRestriction && (
                        <div className="hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-orange-100 border border-orange-200 rounded text-orange-700 text-xs whitespace-nowrap shadow-lg">
                          Planned closure
                        </div>
                      )}
                      {isCurrentWorkshopSlot &&
                        !isAnyRestriction &&
                        !isPlannedClosure && (
                          <div className="hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-green-100 border border-green-200 rounded text-green-700 text-xs whitespace-nowrap shadow-lg">
                            {/* Reserved for this workshop */}
                            Current Workshop Time
                          </div>
                        )}
                      {isCurrentWorkshopEditingSlot &&
                        !isCurrentWorkshopSlot &&
                        !isAnyRestriction &&
                        !isPlannedClosure && (
                          <div className="hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-yellow-100 border border-yellow-200 rounded text-yellow-700 text-xs whitespace-nowrap shadow-lg">
                            {/* Currently editing this workshop date */}
                            Old Workshop Time
                          </div>
                        )}
                      {isOtherWorkshopSlot &&
                        !isCurrentWorkshopSlot &&
                        !isAnyRestriction &&
                        !isPlannedClosure && (
                          <div className="hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-purple-100 border border-purple-200 rounded text-purple-700 text-xs whitespace-nowrap shadow-lg">
                            Reserved for another workshop
                          </div>
                        )}
                      {slot?.isBooked &&
                        !isCurrentWorkshopSlot &&
                        !isAnyRestriction &&
                        !isPlannedClosure &&
                        !(isWorkshopSlot || slot?.reservedForWorkshop) && (
                          <div
                            className={`hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap shadow-lg ${
                              slot?.bookedByMe
                                ? "bg-blue-100 border border-blue-200 text-blue-700"
                                : "bg-red-100 border border-red-200 text-red-700"
                            }`}
                          >
                            {slot?.bookedByMe
                              ? "Booked by you"
                              : "Booked by others"}
                          </div>
                        )}
                      {isPastSlot &&
                        !isCurrentWorkshopSlot &&
                        !isAnyRestriction &&
                        !isPlannedClosure &&
                        !(isWorkshopSlot || slot?.reservedForWorkshop) &&
                        !slot?.isBooked && (
                          <div className="hidden group-hover:block absolute z-20 -mt-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700 text-xs whitespace-nowrap shadow-lg">
                            Time has passed
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
    // Generate tab labels like "May 22-28" or "May 28 - June 3"
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

      // Find the month for the last day
      let lastDayMonth = firstDayMonth;
      if (parseInt(lastDay) < parseInt(firstDay)) {
        // Last day is in the next month
        lastDayMonth = (firstDayMonth + 1) % 12;
      }

      const firstMonthName = new Date(
        currentYear,
        firstDayMonth,
        1
      ).toLocaleString("default", { month: "short" });

      const lastMonthName = new Date(
        currentYear,
        lastDayMonth,
        1
      ).toLocaleString("default", { month: "short" });

      // Check if both days are in the same month
      if (firstDayMonth === lastDayMonth) {
        return `${firstMonthName} ${firstDay}-${lastDay}`;
      } else {
        return `${firstMonthName} ${firstDay} - ${lastMonthName} ${lastDay}`;
      }
    };

    return (
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b mb-2">
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
              {/* 🚫 You do not have the required membership to book equipment. */}
              🚫 {disabledMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4">
      {/* Error Message */}
      {errorMessage && (
        <div className="mb-2 text-red-500 bg-red-100 p-2 rounded border border-red-400 text-xs text-center">
          {errorMessage}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-col items-center mb-1">
        <div className="flex items-center gap-1 justify-center flex-wrap text-xs">
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-pink-100 border border-gray-300" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-white border border-gray-300" />
            <span>Unselected</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-green-500 border border-gray-300" />
            <span>
              {currentWorkshopOccurrences &&
              currentWorkshopOccurrences.length > 0
                ? "Current Workshop Time(s)"
                : "Available"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-yellow-400 border border-gray-300" />
            <span>
              {currentWorkshopOccurrences &&
              currentWorkshopOccurrences.length > 0
                ? "Previous Workshop Time(s)"
                : "Being Edited"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-blue-400 border border-gray-300" />
            <span>Booked by You</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-red-400 border border-gray-300" />
            <span>Booked by Others</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-purple-400 border border-gray-300" />
            <span>Reserved for Workshop</span>
          </div>
          {(level3Restrictions || level4Restrictions) && (
            <div className="flex items-center gap-0.5">
              <div className="w-3 h-3 bg-gray-300 border border-gray-300" />
              <span>Admin Restricted</span>
            </div>
          )}
        </div>

        {/* <p className="text-md font-medium mt-2">Click and Drag to Toggle</p> */}
        <p className="text-sm font-medium mt-1">
          {readOnly
            ? "Equipment availability view"
            : "Click and Drag to Toggle"}
        </p>
      </div>

      {/* Week Tabs */}
      {renderWeekTabs()}
    </div>
  );
}
