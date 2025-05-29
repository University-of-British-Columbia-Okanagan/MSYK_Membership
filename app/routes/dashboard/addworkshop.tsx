import React, { useState } from "react";
import { redirect, useActionData, useLoaderData } from "react-router";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workshopFormSchema } from "../../schemas/workshopFormSchema";
import type { WorkshopFormValues } from "../../schemas/workshopFormSchema";
import { addWorkshop, getWorkshops } from "~/models/workshop.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "~/components/ui/badge";
import GenericFormField from "~/components/ui/GenericFormField";
import DateTypeRadioGroup from "~/components/ui/DateTypeRadioGroup";
import OccurrenceRow from "~/components/ui/OccurrenceRow";
import RepetitionScheduleInputs from "@/components/ui/RepetitionScheduleInputs";
import OccurrencesTabs from "~/components/ui/OccurrenceTabs";
import PrerequisitesField from "@/components/ui/PrerequisitesField";
import {
  getAvailableEquipmentForAdmin,
  getEquipmentSlotsWithStatus,
} from "~/models/equipment.server";
import MultiSelectField from "~/components/ui/MultiSelectField";
import {
  Calendar as CalendarIcon,
  CalendarDays as CalendarDaysIcon,
  CalendarRange as CalendarRangeIcon,
  Check as CheckIcon,
} from "lucide-react";
import EquipmentBookingGrid from "@/components/ui/Dashboard/equipmentbookinggrid";
import type { SlotsByDay } from "@/components/ui/Dashboard/equipmentbookinggrid";
import {
  bulkBookEquipment,
  createEquipmentSlotsForOccurrence,
} from "../../models/equipment.server";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getEquipmentVisibilityDays } from "../../models/admin.server";
import { getUser, getRoleUser } from "../../utils/session.server";

/**
 * Loader to fetch available workshops for prerequisites.
 */
export async function loader({ request }: { request: Request }) {
  const workshops = await getWorkshops();
  const user = await getUser(request);
  const userId = user?.id || undefined;

  const equipmentsRaw = await getEquipmentSlotsWithStatus(userId, true);
  const equipmentVisibilityDays = await getEquipmentVisibilityDays();

  const selectedSlotsMap: Record<number, number[]> = {};
  for (const equipment of equipmentsRaw) {
    const selectedSlotIds: number[] = [];
    for (const day in equipment.slotsByDay) {
      for (const time in equipment.slotsByDay[day]) {
        const slot = equipment.slotsByDay[day][time];
        if (slot?.reservedForWorkshop && slot?.id) {
          selectedSlotIds.push(slot.id);
        }
      }
    }
    if (selectedSlotIds.length > 0) {
      selectedSlotsMap[equipment.id] = selectedSlotIds;
    }
  }

  return {
    workshops,
    equipments: equipmentsRaw,
    selectedSlotsMap,
    equipmentVisibilityDays,
  };
}

/**
 * Helper: Parse a datetime-local string as a local Date.
 */
function parseDateTimeAsLocal(value: string): Date {
  try {
    if (!value) return new Date("");

    // Use Date.parse to handle various date input formats
    const timestamp = Date.parse(value);

    if (isNaN(timestamp)) {
      console.error("Failed to parse date:", value);
      return new Date("");
    }

    const date = new Date(timestamp);

    // Ensure the date is valid
    if (isNaN(date.getTime())) {
      console.error("Invalid date after parsing:", value);
      return new Date("");
    }

    return date;
  } catch (error) {
    console.error("Error parsing date:", error);
    return new Date("");
  }
}

/**
 * Helper: Format a Date as a datetime-local string using local time.
 */
function formatLocalDatetime(date: Date): string {
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDisplayDate(date: Date): string {
  // Format example: Thu, Feb 27, 2025, 01:24 AM
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isDateInPast(date: Date): boolean {
  const now = new Date();
  return date < now && !isNaN(date.getTime());
}

/**
 * Check if any occurrence dates are in the past
 */
function hasOccurrencesInPast(
  occurrences: { startDate: Date; endDate: Date }[]
): boolean {
  return occurrences.some(
    (occ) =>
      (isDateInPast(occ.startDate) || isDateInPast(occ.endDate)) &&
      !isNaN(occ.startDate.getTime()) &&
      !isNaN(occ.endDate.getTime())
  );
}

function checkForEquipmentOverlaps(
  currentOccurrences: { startDate: Date; endDate: Date }[],
  currentSelectedEquipments: number[],
  currentAvailableEquipments: {
    id: number;
    name: string;
    slotsByDay: SlotsByDay;
  }[]
) {
  const overlaps: {
    equipmentId: number;
    name: string;
    overlappingTimes: string[];
  }[] = [];

  // Filter for valid dates only
  const validOccurrences = currentOccurrences.filter(
    (occ) => !isNaN(occ.startDate.getTime()) && !isNaN(occ.endDate.getTime())
  );

  if (validOccurrences.length === 0 || currentSelectedEquipments.length === 0) {
    return overlaps;
  }

  // Check each selected equipment for overlaps
  currentSelectedEquipments.forEach((equipmentId) => {
    const equipment = currentAvailableEquipments.find(
      (eq) => eq.id === equipmentId
    );
    if (!equipment) return;

    const overlappingTimes: string[] = [];

    // For each workshop occurrence, check for overlaps in equipment slots
    validOccurrences.forEach((occ) => {
      // Create 30-minute slots for the entire workshop duration
      const currentTime = new Date(occ.startDate);
      while (currentTime < occ.endDate) {
        // Format day as "Sat 24"
        const dayName = currentTime.toLocaleDateString("en-US", {
          weekday: "short",
        });
        const dayNumber = currentTime.getDate();
        const dayKey = `${dayName} ${dayNumber}`;

        // Format time as "05:00"
        const hours = String(currentTime.getHours()).padStart(2, "0");
        const minutes = String(currentTime.getMinutes()).padStart(2, "0");
        const timeKey = `${hours}:${minutes}`;

        // Check if this slot exists in the equipment's slots and is booked or unavailable
        if (
          equipment.slotsByDay[dayKey] &&
          equipment.slotsByDay[dayKey][timeKey] &&
          (equipment.slotsByDay[dayKey][timeKey].isBooked ||
            equipment.slotsByDay[dayKey][timeKey].reservedForWorkshop)
        ) {
          const formattedTime = `${dayName} ${dayNumber} at ${hours}:${minutes}`;
          if (!overlappingTimes.includes(formattedTime)) {
            overlappingTimes.push(formattedTime);
          }
        }

        // Move to next 30-minute slot
        currentTime.setTime(currentTime.getTime() + 30 * 60 * 1000);
      }
    });

    if (overlappingTimes.length > 0) {
      overlaps.push({
        equipmentId,
        name: equipment.name || `Equipment ${equipmentId}`,
        overlappingTimes,
      });
    }
  });

  return overlaps;
}

// Add this function after your other helper functions
function getEquipmentSlotsForOccurrences(
  occurrences: { startDate: Date; endDate: Date }[]
): { [day: string]: string[] } {
  const slotsForOccurrences: { [day: string]: string[] } = {};

  occurrences.forEach((occ) => {
    if (isNaN(occ.startDate.getTime()) || isNaN(occ.endDate.getTime())) {
      return; // Skip invalid dates
    }

    // Calculate all 30-minute time slots between start and end
    const currentTime = new Date(occ.startDate);
    while (currentTime < occ.endDate) {
      // Format day as "Sat 24" (using the actual day name and number)
      const dayName = currentTime.toLocaleDateString("en-US", {
        weekday: "short",
      });
      const dayNumber = currentTime.getDate();
      const dayKey = `${dayName} ${dayNumber}`;

      // Format time as "05:00"
      const hours = String(currentTime.getHours()).padStart(2, "0");
      const minutes = String(currentTime.getMinutes()).padStart(2, "0");
      const timeKey = `${hours}:${minutes}`;

      // Add to slots map
      if (!slotsForOccurrences[dayKey]) {
        slotsForOccurrences[dayKey] = [];
      }

      // Only add if not already in the array
      if (!slotsForOccurrences[dayKey].includes(timeKey)) {
        slotsForOccurrences[dayKey].push(timeKey);
      }

      // Move to next 30-minute slot
      currentTime.setTime(currentTime.getTime() + 30 * 60 * 1000);
    }
  });

  return slotsForOccurrences;
}

// Add this function to help with auto-selecting workshop slots
function getSlotStringsForOccurrences(
  equipmentId: number,
  occurrences: { startDate: Date; endDate: Date }[]
): string[] {
  const slotStrings: string[] = [];

  occurrences.forEach((occ) => {
    if (isNaN(occ.startDate.getTime()) || isNaN(occ.endDate.getTime())) {
      return; // Skip invalid dates
    }

    // Calculate all 30-minute time slots between start and end
    const currentTime = new Date(occ.startDate);
    while (currentTime < occ.endDate) {
      // Create the slot string format that matches what the grid expects
      const slotStartTime = new Date(currentTime);
      const slotEndTime = new Date(currentTime.getTime() + 30 * 60000);
      const slotString = `${slotStartTime.toISOString()}|${slotEndTime.toISOString()}`;

      // Add to the array
      slotStrings.push(slotString);

      // Move to next 30-minute slot
      currentTime.setTime(currentTime.getTime() + 30 * 60000);
    }
  });

  return slotStrings;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const rawValues = Object.fromEntries(formData.entries());
  let selectedSlots: Record<number, number[]> = {};
  try {
    selectedSlots = JSON.parse(rawValues.selectedSlots as string);
  } catch (error) {
    console.error("Error parsing selected slots:", error);
    return { errors: { selectedSlots: ["Invalid selected slots format"] } };
  }

  // Parse price and capacity
  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);

  // Parse prerequisites from JSON string
  let prerequisites: number[] = [];
  try {
    prerequisites = JSON.parse(rawValues.prerequisites as string).map(Number);
  } catch (error) {
    console.error("Error parsing prerequisites:", error);
    return { errors: { prerequisites: ["Invalid prerequisites format"] } };
  }

  // Parse equipments from JSON string
  let equipments: number[] = [];
  try {
    equipments = JSON.parse(rawValues.equipments as string).map(Number);
  } catch (error) {
    console.error("Error parsing equipments:", error);
    return { errors: { equipments: ["Invalid equipments format"] } };
  }

  // Parse occurrences and validate dates
  let occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST: Date;
    endDatePST: Date;
  }[] = [];
  try {
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: { startDate: string; endDate: string }) => {
        const localStart = new Date(occ.startDate);
        const localEnd = new Date(occ.endDate);

        // Validation: Ensure end date is later than start date
        if (localEnd.getTime() <= localStart.getTime()) {
          throw new Error("End date must be later than start date");
        }

        const startOffset = localStart.getTimezoneOffset();
        const utcStart = new Date(localStart.getTime() - startOffset * 60000);
        const endOffset = localEnd.getTimezoneOffset();
        const utcEnd = new Date(localEnd.getTime() - endOffset * 60000);

        return {
          startDate: localStart,
          endDate: localEnd,
          startDatePST: utcStart,
          endDatePST: utcEnd,
        };
      }
    );
  } catch (error) {
    console.error("Error parsing occurrences:", error);
    return {
      errors: {
        occurrences: [
          error instanceof Error &&
          error.message === "End date must be later than start date"
            ? error.message
            : "Invalid date format",
        ],
      },
    };
  }

  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 419 });
  }

  // Fetch up-to-date available equipment to avoid conflicts
  const availableEquipments = await getAvailableEquipmentForAdmin();
  const availableEquipmentIds = new Set(availableEquipments.map((e) => e.id));

  //Ensure selected equipment is still available
  const unavailableEquipments = equipments.filter(
    (id) => !availableEquipmentIds.has(id)
  );
  if (unavailableEquipments.length > 0) {
    return {
      errors: {
        equipments: ["One or more selected equipment are no longer available."],
      },
    };
  }

  //  Ensure no selected equipment conflicts with workshop occurrences
  for (const equipmentId of equipments) {
    const conflictingEquipment = availableEquipments.find(
      (e) => e.id === equipmentId
    );

    if (conflictingEquipment?.slots) {
      for (const occ of occurrences) {
        const conflict = conflictingEquipment.slots.some(
          (slot) =>
            new Date(slot.startTime).getTime() >= occ.startDate.getTime() &&
            new Date(slot.startTime).getTime() < occ.endDate.getTime() &&
            slot.workshopOccurrenceId !== null
        );

        if (conflict) {
          return {
            errors: {
              equipments: [
                `The equipment "${conflictingEquipment.name}" is booked during your workshop time.`,
              ],
            },
          };
        }
      }
    }
  }

  for (const equipmentId of equipments) {
    const conflictingEquipment = availableEquipments.find(
      (e) => e.id === equipmentId
    );

    if (conflictingEquipment?.slots) {
      for (const occ of occurrences) {
        // Check each 30-minute slot during the workshop
        const currentTime = new Date(occ.startDate);
        while (currentTime < occ.endDate) {
          // Find if any slot at this time is already booked
          const conflictingSlot = conflictingEquipment.slots.find(
            (slot) =>
              new Date(slot.startTime).getTime() === currentTime.getTime() &&
              (slot.isBooked || slot.workshopOccurrenceId !== null)
          );

          if (conflictingSlot) {
            const formattedTime = new Date(currentTime).toLocaleString(
              undefined,
              {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true,
              }
            );

            return {
              errors: {
                equipments: [
                  `The equipment "${conflictingEquipment.name}" is already booked at ${formattedTime}. Please choose different dates or equipment.`,
                ],
              },
            };
          }

          // Move to next 30-minute slot
          currentTime.setTime(currentTime.getTime() + 30 * 60 * 1000);
        }
      }
    }
  }

  const isWorkshopContinuation = rawValues.isWorkshopContinuation === "true";

  //  Validate form data using Zod schema
  const parsed = workshopFormSchema.safeParse({
    ...rawValues,
    price,
    capacity,
    occurrences,
    prerequisites,
    equipments,
    isWorkshopContinuation,
  });

  if (!parsed.success) {
    console.log("Validation Errors:", parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  //  Save the workshop to the database
  try {
    const savedWorkshop = await addWorkshop(
      {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        location: parsed.data.location,
        capacity: parsed.data.capacity,
        type: parsed.data.type,
        occurrences: parsed.data.occurrences,
        prerequisites: parsed.data.prerequisites,
        equipments: parsed.data.equipments,
        isWorkshopContinuation: parsed.data.isWorkshopContinuation,
        selectedSlots,
      },
      request
    );

    const allSelectedSlotIds = Object.values(selectedSlots).flat().map(Number);

    // try {
    //   await bulkBookEquipment(savedWorkshop.id, allSelectedSlotIds);
    //   return redirect("/dashboard/admin");
    // } catch (error) {
    //   console.error("Failed to reserve equipment slots:", error);
    //   return {
    //     errors: {
    //       slots: ["Failed to reserve equipment slots. Please try again."],
    //     },
    //   };
    // }
    // Process workshop time slots for equipment
    // Process workshop time slots for equipment
    // Process workshop time slots for equipment
    try {
      // Get the current user ID
      const user = await getUser(request);
      const userId = user?.id || 1; // Default to 1 if no user found

      // First, check if there are any valid slot IDs to book
      const validSelectedSlotIds = allSelectedSlotIds.filter((id) => id > 0);

      if (validSelectedSlotIds.length > 0) {
        try {
          // Only attempt to book if we have valid slots
          await bulkBookEquipment(
            savedWorkshop.id,
            validSelectedSlotIds,
            userId
          );
        } catch (error) {
          console.error("Error in bulkBookEquipment:", error);
          // Continue with the rest of the process instead of failing
        }
      } else {
        console.log(
          "No valid equipment slots selected, skipping bulkBookEquipment"
        );
      }

      // Create slots for all workshop occurrences
      for (const occurrence of savedWorkshop.occurrences) {
        for (const equipmentId of equipments) {
          try {
            await createEquipmentSlotsForOccurrence(
              occurrence.id,
              equipmentId,
              occurrence.startDate,
              occurrence.endDate,
              userId
            );
          } catch (error) {
            console.error(
              `Error creating slots for equipment ${equipmentId}:`,
              error
            );
            // Continue with other equipment instead of failing the whole operation
          }
        }
      }

      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Failed to reserve equipment slots:", error);
      return {
        errors: {
          slots: ["Failed to reserve equipment slots. Please try again."],
        },
      };
    }
  } catch (error) {
    console.error("Error adding workshop:", error);
    return { errors: { database: ["Failed to add workshop"] } };
  }
}

export default function AddWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const {
    workshops: availableWorkshops,
    equipments: availableEquipments,
    equipmentVisibilityDays,
  } = useLoaderData() as {
    workshops: { id: number; name: string; type: string }[];
    equipments: {
      id: number;
      name: string;
      slotsByDay: SlotsByDay;
    }[];
    selectedSlotsMap: Record<number, number[]>;
    equipmentVisibilityDays: number;
    userId: number;
  };

  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      location: "",
      capacity: 0,
      type: "workshop",
      occurrences: [],
      prerequisites: [],
      equipments: [],
    },
  });

  // Occurrences will be stored as local Date objects.
  const [occurrences, setOccurrences] = useState<
    { startDate: Date; endDate: Date }[]
  >([]);
  const [dateSelectionType, setDateSelectionType] = useState<
    "custom" | "weekly" | "monthly"
  >("custom");

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // This will track the selected prerequisites
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<number[]>(
    []
  );
  const sortedSelectedPrerequisites = [...selectedPrerequisites].sort(
    (a, b) => a - b
  );

  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(
    null
  );
  const [selectedEquipments, setSelectedEquipments] = useState<number[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const { selectedSlotsMap: initialSelectedSlotsMap } = useLoaderData() as {
    workshops: { id: number; name: string; type: string }[];
    equipments: {
      id: number;
      name: string;
      slotsByDay: SlotsByDay;
    }[];
    selectedSlotsMap: Record<number, number[]>;
  };
  const [selectedSlotsMap, setSelectedSlotsMap] = useState<
    Record<number, number[]>
  >(initialSelectedSlotsMap || {});

  const [equipmentOverlaps, setEquipmentOverlaps] = useState<
    {
      equipmentId: number;
      name: string;
      overlappingTimes: string[];
    }[]
  >([]);
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const [proceedDespiteOverlaps, setProceedDespiteOverlaps] = useState(false);

  // Weekly-specific state
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [weeklyCount, setWeeklyCount] = useState(1);
  const [weeklyStartDate, setWeeklyStartDate] = useState("");
  const [weeklyEndDate, setWeeklyEndDate] = useState("");

  // Monthly-specific state
  const [monthlyInterval, setMonthlyInterval] = useState(1);
  const [monthlyCount, setMonthlyCount] = useState(1);
  const [monthlyStartDate, setMonthlyStartDate] = useState("");
  const [monthlyEndDate, setMonthlyEndDate] = useState("");

  const [isWorkshopContinuation, setIsWorkshopContinuation] = useState(false);

  // For custom dates, add an empty occurrence.
  const addOccurrence = () => {
    const newOccurrence = { startDate: new Date(""), endDate: new Date("") };
    const updatedOccurrences = [...occurrences, newOccurrence];
    // Sort by startDate (if dates are valid)
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );
    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  };

  // Update an occurrence when its datetime input changes.
  function updateOccurrence(
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) {
    const localDate = parseDateTimeAsLocal(value);
    const updatedOccurrences = [...occurrences];
    updatedOccurrences[index][field] = localDate;
    // Re-sort the list after updating.
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );
    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  }

  // Remove an occurrence.
  const removeOccurrence = (index: number) => {
    const updated = occurrences.filter((_, i) => i !== index);
    setOccurrences(updated);
    form.setValue("occurrences", updated);
  };

  // Check for duplicate dates.
  const isDuplicateDate = (newDate: Date, existingDates: Date[]): boolean => {
    return existingDates.some(
      (existingDate) => existingDate.getTime() === newDate.getTime()
    );
  };

  // Add this function to handle prerequisite selection
  const handlePrerequisiteSelect = (workshopId: number) => {
    if (selectedPrerequisites.includes(workshopId)) {
      // Remove if already selected
      const updated = selectedPrerequisites.filter((id) => id !== workshopId);
      setSelectedPrerequisites(updated);
      form.setValue("prerequisites", updated);
    } else {
      // Add if not already selected
      const updated = [...selectedPrerequisites, workshopId];
      setSelectedPrerequisites(updated);
      form.setValue("prerequisites", updated);
    }
  };

  // Add this function to remove a prerequisite
  const removePrerequisite = (workshopId: number) => {
    const updated = selectedPrerequisites.filter((id) => id !== workshopId);
    setSelectedPrerequisites(updated);
    form.setValue("prerequisites", updated);
  };

  // const handleFormSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();

  //   // First check if any dates are in the past
  //   if (hasOccurrencesInPast(occurrences)) {
  //     setIsConfirmDialogOpen(true);
  //     return; // Important: prevent the normal form submission flow
  //   } else {
  //     // No past dates, submit directly
  //     setFormSubmitting(true);
  //     const form = e.currentTarget as HTMLFormElement;
  //     form.submit();
  //   }
  // };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for overlaps first
    const overlaps = checkForEquipmentOverlaps(
      occurrences,
      selectedEquipments,
      availableEquipments
    );

    if (overlaps.length > 0 && !proceedDespiteOverlaps) {
      setEquipmentOverlaps(overlaps);
      setShowOverlapConfirm(true);
      return; // Stop form submission
    }

    // Reset overlap flag after using it
    if (proceedDespiteOverlaps) {
      setProceedDespiteOverlaps(false);
    }

    // Then check if any dates are in the past (your existing code)
    if (hasOccurrencesInPast(occurrences)) {
      setIsConfirmDialogOpen(true);
      return;
    } else {
      // No past dates, submit directly
      setFormSubmitting(true);
      const form = e.currentTarget as HTMLFormElement;
      form.submit();
    }
  };

  {
    /* This is for duplicate workshop from multi day workshop */
  }
  React.useEffect(() => {
    const duplicateData = localStorage.getItem("duplicateWorkshopData");

    if (duplicateData) {
      try {
        const workshopData = JSON.parse(duplicateData);

        // Pre-fill the form with the workshop data
        form.setValue("name", `${workshopData.name} (Copy)`);
        form.setValue("description", workshopData.description);
        form.setValue("price", workshopData.price);
        form.setValue("location", workshopData.location);
        form.setValue("capacity", workshopData.capacity);
        form.setValue("type", workshopData.type);

        // Set prerequisites
        if (
          workshopData.prerequisites &&
          workshopData.prerequisites.length > 0
        ) {
          setSelectedPrerequisites(workshopData.prerequisites);
          form.setValue("prerequisites", workshopData.prerequisites);
        }

        // Set equipments
        if (workshopData.equipments && workshopData.equipments.length > 0) {
          setSelectedEquipments(workshopData.equipments);
          form.setValue("equipments", workshopData.equipments);
        }

        // Set continuation flag
        setIsWorkshopContinuation(!!workshopData.isContinuation);

        // Clear the localStorage to prevent pre-filling again on refresh
        localStorage.removeItem("duplicateWorkshopData");
      } catch (error) {
        console.error("Error parsing duplicate workshop data:", error);
      }
    }
  }, [
    form,
    setSelectedPrerequisites,
    setSelectedEquipments,
    setIsWorkshopContinuation,
  ]); // Include dependencies

  // Add this useEffect to update the selected slots when occurrences change
  React.useEffect(() => {
    // Only process valid occurrences
    const validOccurrences = occurrences.filter(
      (occ) => !isNaN(occ.startDate.getTime()) && !isNaN(occ.endDate.getTime())
    );

    if (validOccurrences.length > 0 && selectedEquipments.length > 0) {
      // Create a new map to store the selected slots
      const newSlotsMap: Record<number, number[]> = { ...selectedSlotsMap };

      // For each equipment, add the slots from the occurrences
      selectedEquipments.forEach((equipmentId) => {
        // Get existing selected slots for this equipment
        const existingSlots = selectedSlotsMap[equipmentId] || [];

        // For workshop dates, we'll use dummy slot IDs (negative numbers)
        // These will be replaced with real slot IDs when saved to the database
        const slotStrings = getSlotStringsForOccurrences(
          equipmentId,
          validOccurrences
        );

        // Use -1, -2, etc. as temporary IDs for slots that don't exist yet
        const newSlotIds = Array.from(
          { length: slotStrings.length },
          (_, i) => -(i + 1)
        );

        // Combine existing selected slots with new workshop slots
        newSlotsMap[equipmentId] = [...existingSlots, ...newSlotIds];
      });

      // Update the selected slots map
      setSelectedSlotsMap(newSlotsMap);
    }
  }, [occurrences, selectedEquipments]); // Run when occurrences or selected equipments change

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">Add Workshop</h1>

      {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post" onSubmit={handleFormSubmit}>
          {/* Workshop Fields */}
          <GenericFormField
            control={form.control}
            name="name"
            label="Name"
            placeholder="Workshop Name"
            required
            error={actionData?.errors?.name}
          />
          <GenericFormField
            control={form.control}
            name="description"
            label="Description"
            placeholder="Workshop Description"
            required
            error={actionData?.errors?.description}
            component={Textarea} // use Textarea instead of Input
            className="w-full" // override default if needed
            rows={5}
          />
          <GenericFormField
            control={form.control}
            name="price"
            label="Price"
            placeholder="Price"
            required
            error={actionData?.errors?.price}
            type="number"
          />
          <GenericFormField
            control={form.control}
            name="location"
            label="Location"
            placeholder="Workshop Location"
            required
            error={actionData?.errors?.location}
          />
          <GenericFormField
            control={form.control}
            name="capacity"
            label="Capacity"
            placeholder="Capacity"
            required
            error={actionData?.errors?.capacity}
            type="number"
          />

          {/* New "Is Workshop Continuation" Checkbox */}
          <div className="mt-6 mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
            <label className="flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isWorkshopContinuation}
                  onChange={(e) => setIsWorkshopContinuation(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-6 h-6 bg-white border border-gray-300 rounded-md peer-checked:bg-yellow-500 peer-checked:border-yellow-500 transition-all duration-200"></div>
                <CheckIcon className="absolute h-4 w-4 text-white top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <span className="font-small">Multi-day Workshop</span>
            </label>
            <p className="mt-2 pl-9 text-sm text-gray-500">
              Check this if this workshop is a multi-day workshop
            </p>
          </div>

          <FormField
            control={form.control}
            name="occurrences"
            render={() => (
              <FormItem className="mt-6">
                <div className="flex items-center mb-2">
                  <FormLabel
                    htmlFor="occurrences"
                    className="text-lg font-medium mb-0"
                  >
                    Workshop Dates <span className="text-red-500">*</span>
                  </FormLabel>
                  {occurrences.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 bg-yellow-100 border-yellow-200"
                    >
                      {occurrences.length} date
                      {occurrences.length !== 1 ? "s" : ""} added
                    </Badge>
                  )}
                </div>
                <FormControl>
                  <div className="flex flex-col items-start space-y-6 w-full">
                    {/* Radio Buttons for selecting date input type - enhanced version */}
                    <div className="w-full p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
                      <DateTypeRadioGroup
                        options={[
                          {
                            value: "custom",
                            label: "Manage dates",
                            icon: CalendarIcon,
                          },
                          {
                            value: "weekly",
                            label: "Append weekly dates",
                            icon: CalendarDaysIcon,
                          },
                          {
                            value: "monthly",
                            label: "Append monthly dates",
                            icon: CalendarRangeIcon,
                          },
                        ]}
                        selectedValue={dateSelectionType}
                        onChange={(val) =>
                          setDateSelectionType(
                            val as "custom" | "weekly" | "monthly"
                          )
                        }
                        name="dateType"
                        className="grid grid-cols-1 md:grid-cols-3 gap-3"
                        itemClassName="flex-1"
                      />
                    </div>

                    {/* Custom Dates Input - keep the implementation but wrapped in a better card */}
                    {dateSelectionType === "custom" && (
                      <div className="flex flex-col items-center w-full p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        {occurrences.length === 0 ? (
                          <div className="text-center py-6 text-gray-500">
                            <p className="text-sm">
                              No dates added yet. Click the button below to add
                              workshop dates.
                            </p>
                          </div>
                        ) : (
                          occurrences.map((occ, index) => {
                            const isStartDatePast = isDateInPast(occ.startDate);
                            const isEndDatePast = isDateInPast(occ.endDate);
                            const hasWarning = isStartDatePast || isEndDatePast;

                            return (
                              <TooltipProvider key={index}>
                                <Tooltip open={hasWarning ? undefined : false}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "w-full",
                                        hasWarning &&
                                          "border-l-4 border-amber-500 pl-2"
                                      )}
                                    >
                                      <OccurrenceRow
                                        key={index}
                                        index={index}
                                        occurrence={occ}
                                        updateOccurrence={updateOccurrence}
                                        formatLocalDatetime={
                                          formatLocalDatetime
                                        }
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  {hasWarning && (
                                    <TooltipContent
                                      side="right"
                                      className="bg-amber-100 text-amber-800 border border-amber-300"
                                    >
                                      <p className="text-sm font-medium">
                                        {isStartDatePast && isEndDatePast
                                          ? "Both start and end dates are in the past"
                                          : isStartDatePast
                                          ? "Start date is in the past"
                                          : "End date is in the past"}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })
                        )}
                        <Button
                          type="button"
                          onClick={addOccurrence}
                          className="mt-1 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-md shadow transition text-sm flex items-center"
                        >
                          <span className="mr-1">+</span> Add Date
                        </Button>
                      </div>
                    )}

                    {/* Keep the existing code for weekly and monthly options */}
                    {dateSelectionType === "weekly" && (
                      // Existing code for weekly
                      <div className="w-full p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <RepetitionScheduleInputs
                          scheduleType="weekly"
                          startDate={weeklyStartDate}
                          setStartDate={setWeeklyStartDate}
                          endDate={weeklyEndDate}
                          setEndDate={setWeeklyEndDate}
                          interval={weeklyInterval}
                          setInterval={setWeeklyInterval}
                          count={weeklyCount}
                          setCount={setWeeklyCount}
                          occurrences={occurrences}
                          setOccurrences={setOccurrences}
                          updateFormOccurrences={(updatedOccurrences) => {
                            console.log(
                              "Updating Form Occurrences:",
                              updatedOccurrences
                            );
                            form.setValue("occurrences", updatedOccurrences);
                          }}
                          parseDateTimeAsLocal={parseDateTimeAsLocal}
                          isDuplicateDate={isDuplicateDate}
                          onRevert={() => setDateSelectionType("weekly")}
                        />
                      </div>
                    )}

                    {/* Similar wrapping for monthly option */}
                    {dateSelectionType === "monthly" && (
                      <div className="w-full p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <RepetitionScheduleInputs
                          scheduleType="monthly"
                          startDate={monthlyStartDate}
                          setStartDate={setMonthlyStartDate}
                          endDate={monthlyEndDate}
                          setEndDate={setMonthlyEndDate}
                          interval={monthlyInterval}
                          setInterval={setMonthlyInterval}
                          count={monthlyCount}
                          setCount={setMonthlyCount}
                          occurrences={occurrences}
                          setOccurrences={setOccurrences}
                          updateFormOccurrences={(updatedOccurrences) => {
                            console.log(
                              "Updating Form Occurrences:",
                              updatedOccurrences
                            );
                            form.setValue("occurrences", updatedOccurrences);
                          }}
                          parseDateTimeAsLocal={parseDateTimeAsLocal}
                          isDuplicateDate={isDuplicateDate}
                          onRevert={() => setDateSelectionType("monthly")}
                        />
                      </div>
                    )}

                    {/* Improved display of occurrences */}
                    {occurrences.length > 0 && (
                      <div className="w-full">
                        <h3 className="font-medium mb-4 flex items-center">
                          <CalendarIcon className="w-5 h-5 mr-2 text-yellow-500" />
                          Your Workshop Dates
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {occurrences.map((occ, index) => {
                            const isStartDatePast = isDateInPast(occ.startDate);
                            const isEndDatePast = isDateInPast(occ.endDate);
                            const hasWarning = isStartDatePast || isEndDatePast;

                            return (
                              <div
                                key={index}
                                className={cn(
                                  "flex justify-between items-center p-3 bg-white border-b last:border-b-0 hover:bg-gray-50 transition-colors duration-150",
                                  hasWarning && "border-l-4 border-amber-500"
                                )}
                              >
                                <div className="flex-1">
                                  <div className="font-medium flex items-center">
                                    {formatDisplayDate(occ.startDate)}
                                    {isStartDatePast && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 bg-amber-100 text-amber-800 border-amber-300 text-xs"
                                      >
                                        Past Date
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 flex items-center">
                                    to {formatDisplayDate(occ.endDate)}
                                    {isEndDatePast && !isStartDatePast && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 bg-amber-100 text-amber-800 border-amber-300 text-xs"
                                      >
                                        Past Date
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <ConfirmButton
                                  confirmTitle="Delete Occurrence"
                                  confirmDescription="Are you sure you want to delete this occurrence?"
                                  onConfirm={() => removeOccurrence(index)}
                                  buttonLabel="Remove"
                                  buttonClassName="text-sm bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-300 py-1 px-3 rounded"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage>{actionData?.errors?.occurrences}</FormMessage>
              </FormItem>
            )}
          />

          {/* Prerequisites */}
          {form.watch("type") !== "orientation" ? (
            <MultiSelectField
              control={form.control}
              name="prerequisites"
              label="Prerequisites"
              options={availableWorkshops}
              selectedItems={selectedPrerequisites}
              onSelect={handlePrerequisiteSelect}
              onRemove={removePrerequisite}
              error={actionData?.errors?.prerequisites}
              placeholder="Select prerequisites..."
              helperText="Select workshops of type Orientation that must be completed before enrolling."
              filterFn={(item) => item.type.toLowerCase() === "orientation"}
            />
          ) : (
            <div className="mt-4 mb-4 text-gray-500 text-center text-sm">
              Orientation workshops does not have prerequisites.
            </div>
          )}

          {/* Equipments */}
          <MultiSelectField
            control={form.control}
            name="equipments"
            label="Equipment"
            options={availableEquipments}
            selectedItems={selectedEquipments}
            onSelect={(equipmentId: number) => {
              // Add equipment to selection if not already selected
              if (!selectedEquipments.includes(equipmentId)) {
                // Update the selected equipments state
                const updatedEquipments = [...selectedEquipments, equipmentId];
                setSelectedEquipments(updatedEquipments);

                // Set the form value directly (not with a function)
                form.setValue("equipments", updatedEquipments);

                // Initialize the slots map for this equipment if needed
                if (!selectedSlotsMap[equipmentId]) {
                  setSelectedSlotsMap({
                    ...selectedSlotsMap,
                    [equipmentId]: [],
                  });
                }
              }
            }}
            onRemove={(equipmentId: number) => {
              // Remove equipment from selection
              const updatedEquipments = selectedEquipments.filter(
                (id) => id !== equipmentId
              );

              // Update state
              setSelectedEquipments(updatedEquipments);

              // Set form value directly
              form.setValue("equipments", updatedEquipments);

              // Remove slots for this equipment
              const newMap = { ...selectedSlotsMap };
              delete newMap[equipmentId];
              setSelectedSlotsMap(newMap);
            }}
            error={actionData?.errors?.equipments}
            placeholder="Select equipment..."
            helperText="Select equipment that will be used in this workshop."
          />

          {/* Equipment Slot Pickers */}
          {/* Equipment Slot Pickers */}
          {selectedEquipments.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">
                Equipment Availability Grids
              </h3>

              <div className="mb-4 text-sm text-center text-amber-600 bg-amber-100 p-3 rounded border border-amber-300">
                <p>Workshop dates are shown in green. Grid is read only.</p>
              </div>

              <Tabs
                defaultValue={[...selectedEquipments]
                  .sort((a, b) => a - b)[0]
                  .toString()}
                className="w-full"
              >
                <TabsList className="mb-4">
                  {[...selectedEquipments]
                    .sort((a, b) => a - b)
                    .map((equipmentId) => {
                      const equipment = availableEquipments.find(
                        (eq) => eq.id === equipmentId
                      );
                      return (
                        <TabsTrigger
                          key={`eq-tab-${equipmentId}`}
                          value={equipmentId.toString()}
                          className="px-4 py-2"
                        >
                          {equipment?.name || `Equipment ${equipmentId}`}
                        </TabsTrigger>
                      );
                    })}
                </TabsList>

                {[...selectedEquipments]
                  .sort((a, b) => a - b)
                  .map((equipmentId) => {
                    const equipment = availableEquipments.find(
                      (eq) => eq.id === equipmentId
                    );

                    // Filter for valid dates only
                    const validOccurrences = occurrences.filter(
                      (occ) =>
                        !isNaN(occ.startDate.getTime()) &&
                        !isNaN(occ.endDate.getTime())
                    );

                    return (
                      <TabsContent
                        key={`eq-content-${equipmentId}`}
                        value={equipmentId.toString()}
                        className="mt-0 p-0"
                      >
                        <EquipmentBookingGrid
                          slotsByDay={equipment?.slotsByDay || {}}
                          onSelectSlots={(slots: string[]) => {
                            // This will never be called since we're using readOnly mode
                            console.log(
                              "Equipment grid is read-only, selections ignored"
                            );
                          }}
                          readOnly={true} // Use readOnly instead of disabled
                          disabled={false} // Keep disabled=false so the grid is not greyed out
                          visibleDays={equipmentVisibilityDays}
                          workshopSlots={getEquipmentSlotsForOccurrences(
                            validOccurrences
                          )}
                          currentWorkshopOccurrences={validOccurrences}
                        />
                      </TabsContent>
                    );
                  })}
              </Tabs>
            </div>
          )}

          {/* Type */}
          <GenericFormField
            control={form.control}
            name="type"
            label="Workshop Type"
            required
            error={actionData?.errors?.type}
            component="select" // Render a native select element
            className="w-full border rounded-md p-2"
          >
            <option value="workshop">Workshop</option>
            <option value="orientation">Orientation</option>
          </GenericFormField>

          {/* Hidden input for occurrences */}
          <input
            type="hidden"
            name="occurrences"
            value={JSON.stringify(
              occurrences
                .filter(
                  (occ) =>
                    !isNaN(occ.startDate.getTime()) &&
                    !isNaN(occ.endDate.getTime())
                )
                .map((occ) => ({
                  startDate: occ.startDate.toISOString(),
                  endDate: occ.endDate.toISOString(),
                }))
            )}
          />

          {/* Hidden input for prerequisites */}
          <input
            type="hidden"
            name="prerequisites"
            value={JSON.stringify(selectedPrerequisites || [])}
          />
          <input
            type="hidden"
            name="equipments"
            value={JSON.stringify(selectedEquipments)}
          />
          {/* Hidden input for selected slots */}
          <input
            type="hidden"
            name="selectedSlots"
            value={JSON.stringify(selectedSlotsMap)}
          />

          <input
            type="hidden"
            name="isWorkshopContinuation"
            value={isWorkshopContinuation ? "true" : "false"}
          />

          <AlertDialog
            open={showOverlapConfirm}
            onOpenChange={setShowOverlapConfirm}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">
                  Equipment Booking Conflicts Detected
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <p>
                    Your workshop dates overlap with existing bookings for the
                    following equipment:
                  </p>
                  <div className="mt-2 space-y-2">
                    {equipmentOverlaps.map((overlap, index) => (
                      <div
                        key={index}
                        className="border-l-4 border-red-500 pl-3 py-2 bg-red-50"
                      >
                        <p className="font-medium">{overlap.name}</p>
                        <ul className="text-sm mt-1 list-disc pl-5">
                          {overlap.overlappingTimes
                            .slice(0, 3)
                            .map((time, idx) => (
                              <li key={idx}>{time}</li>
                            ))}
                          {overlap.overlappingTimes.length > 3 && (
                            <li>
                              ...and {overlap.overlappingTimes.length - 3} more
                              times
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm mt-4 font-medium">
                    Workshop cannot be scheduled at times when equipment is
                    already booked. Please adjust your workshop dates or select
                    different equipment.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Go Back & Edit</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Submit Button */}
          <AlertDialog
            open={isConfirmDialogOpen}
            onOpenChange={setIsConfirmDialogOpen}
          ></AlertDialog>
          {/* Submit Button */}
          <AlertDialog
            open={isConfirmDialogOpen}
            onOpenChange={setIsConfirmDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Warning: Past Workshop Dates
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Some of your workshop dates are in the past. Are you sure you
                  want to create a workshop with past dates?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    // Close the dialog
                    setIsConfirmDialogOpen(false);
                    // Set the form as submitting
                    setFormSubmitting(true);
                    // Use the native form submission to trigger the action function's redirect
                    const form = document.querySelector(
                      "form"
                    ) as HTMLFormElement;
                    if (form) form.submit();
                  }}
                >
                  Proceed Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>

            <Button
              type="submit"
              className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
              onClick={() => {
                console.log("Final Form Data:", form.getValues());
              }}
              disabled={formSubmitting}
            >
              Submit
            </Button>
          </AlertDialog>
        </form>
      </Form>
    </div>
  );
}
