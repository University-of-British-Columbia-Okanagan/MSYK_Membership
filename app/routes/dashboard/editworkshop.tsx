import React, { useState } from "react";
import {
  redirect,
  useNavigation,
  useActionData,
  useLoaderData,
} from "react-router";
import { Button } from "@/components/ui/button";
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
import {
  getWorkshopById,
  updateWorkshopWithOccurrences,
  cancelWorkshopOccurrence,
  getWorkshops,
  getWorkshopContinuationUserCount,
} from "~/models/workshop.server";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import GenericFormField from "~/components/ui/GenericFormField";
import DateTypeRadioGroup from "~/components/ui/DateTypeRadioGroup";
import OccurrenceRow from "~/components/ui/OccurrenceRow";
import RepetitionScheduleInputs from "@/components/ui/RepetitionScheduleInputs";
import OccurrencesTabs from "~/components/ui/OccurrenceTabs";
import PrerequisitesField from "@/components/ui/PrerequisitesField";
import { getAvailableEquipment } from "~/models/equipment.server";
import MultiSelectField from "@/components/ui/MultiSelectField";
import {
  Calendar as CalendarIcon,
  CalendarDays as CalendarDaysIcon,
  CalendarRange as CalendarRangeIcon,
  Check as CheckIcon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  getEquipmentSlotsWithStatus,
  bulkBookEquipment,
  createEquipmentSlotsForOccurrence,
} from "~/models/equipment.server";
import { getEquipmentVisibilityDays } from "~/models/admin.server";
import { getUser } from "~/utils/session.server";
import EquipmentBookingGrid from "@/components/ui/Dashboard/equipmentbookinggrid";
import type { SlotsByDay } from "@/components/ui/Dashboard/equipmentbookinggrid";

interface Occurrence {
  id?: number;
  startDate: Date;
  endDate: Date;
  startDatePST?: Date;
  endDatePST?: Date;
  status?: string;
  userCount?: number;
  connectId?: number | null;
  offerId?: number | null; // Add this line
}

/* ──────────────────────────────────────────────────────────────────────────────
   1) Loader: fetch the Workshop + its WorkshopOccurrences
   ---------------------------------------------------------------------------*/
/* ──────────────────────────────────────────────────────────────────────────────
   1) Loader: fetch the Workshop + its WorkshopOccurrences
   ---------------------------------------------------------------------------*/
export async function loader({
  params,
  request,
}: {
  params: { workshopId: string };
  request: Request;
}) {
  const workshop = await getWorkshopById(Number(params.workshopId));
  const availableWorkshops = await getWorkshops();
  const availableEquipments = await getAvailableEquipment();
  const userCounts = await getWorkshopContinuationUserCount(
    Number(params.workshopId)
  );

  // Get user ID from session if available (for equipment booking UI)
  const user = await getUser(request);
  const userId = user?.id || undefined;

  // Get equipment slots and visibility days
  const equipmentsWithSlots = await getEquipmentSlotsWithStatus(userId);
  const equipmentVisibilityDays = await getEquipmentVisibilityDays();

  // Create a mapping of selected equipment slots
  const selectedSlotsMap: Record<number, number[]> = {};
  for (const equipment of equipmentsWithSlots) {
    const selectedSlotIds: number[] = [];
    for (const day in equipment.slotsByDay) {
      for (const time in equipment.slotsByDay[day]) {
        const slot = equipment.slotsByDay[day][time];
        // Check if this slot is reserved for this specific workshop
        if (
          slot?.reservedForWorkshop &&
          slot?.id &&
          slot.workshopName === workshop.name
        ) {
          selectedSlotIds.push(slot.id);
        }
      }
    }
    if (selectedSlotIds.length > 0) {
      selectedSlotsMap[equipment.id] = selectedSlotIds;
    }
  }

  if (!workshop) {
    throw new Response("Workshop Not Found", { status: 404 });
  }

  return {
    workshop,
    availableWorkshops,
    availableEquipments,
    userCounts,
    equipments: equipmentsWithSlots,
    selectedSlotsMap,
    equipmentVisibilityDays,
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
   2) Action: convert local occurrences to UTC, then update both Workshop + 
      WorkshopOccurrences in the DB.
   ---------------------------------------------------------------------------*/
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { workshopId: string };
}) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  // Check if this submission is a cancellation request.
  if (rawValues.cancelOccurrenceId) {
    const occurrenceId = parseInt(rawValues.cancelOccurrenceId as string, 10);
    const isWorkshopContinuation = rawValues.isWorkshopContinuation === "true";

    try {
      if (isWorkshopContinuation) {
        // Get all active occurrences for this workshop and cancel them
        const workshop = await getWorkshopById(Number(params.workshopId));
        const activeOccurrences = workshop.occurrences.filter(
          (occ: any) => occ.status === "active"
        );

        // Cancel all active occurrences
        for (const occ of activeOccurrences) {
          await cancelWorkshopOccurrence(occ.id);
        }
      } else {
        // Cancel just the specified occurrence
        await cancelWorkshopOccurrence(occurrenceId);
      }
    } catch (error) {
      console.error("Error cancelling occurrence(s):", error);
      return { errors: { cancel: ["Failed to cancel occurrence(s)"] } };
    }
    return redirect("/dashboard/admin");
  }

  let selectedSlots: Record<number, number[]> = {};
  try {
    selectedSlots = JSON.parse(rawValues.selectedSlots as string);
  } catch (error) {
    console.error("Error parsing selected slots:", error);
    return { errors: { selectedSlots: ["Invalid selected slots format"] } };
  }

  // Convert price & capacity
  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);
  const prerequisites = JSON.parse(rawValues.prerequisites as string).map(
    Number
  );
  const equipments = JSON.parse(rawValues.equipments as string).map(Number);

  const isWorkshopContinuation = rawValues.isWorkshopContinuation === "true";

  let occurrences: {
    id?: number;
    status?: string;
    userCount?: number;
    startDate: Date;
    endDate: Date;
    startDatePST: Date;
    endDatePST: Date;
  }[] = [];
  try {
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: {
        id?: number;
        status?: string;
        userCount?: number;
        startDate: string;
        endDate: string;
      }) => {
        const localStart = new Date(occ.startDate);
        const localEnd = new Date(occ.endDate);

        // VALIDATION CHECK: Ensure end date is later than start date
        if (localEnd.getTime() <= localStart.getTime()) {
          throw new Error("End date must be later than start date");
        }

        const startOffset = localStart.getTimezoneOffset();
        const utcStart = new Date(localStart.getTime() - startOffset * 60000);
        const endOffset = localEnd.getTimezoneOffset();
        const utcEnd = new Date(localEnd.getTime() - endOffset * 60000);

        return {
          id: occ.id,
          status: occ.status,
          userCount: occ.userCount,
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
    console.log(parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // try {
  //   await updateWorkshopWithOccurrences(Number(params.workshopId), {
  //     name: parsed.data.name,
  //     description: parsed.data.description,
  //     price: parsed.data.price,
  //     location: parsed.data.location,
  //     capacity: parsed.data.capacity,
  //     type: parsed.data.type,
  //     occurrences: parsed.data.occurrences,
  //     prerequisites: parsed.data.prerequisites,
  //     equipments: parsed.data.equipments,
  //     isWorkshopContinuation: parsed.data.isWorkshopContinuation,
  //   });
  // } catch (error) {
  //   console.error("Error updating workshop:", error);
  //   return { errors: { database: ["Failed to update workshop"] } };
  // }
  // return redirect("/dashboard/admin");
  try {
    // Update the workshop
    await updateWorkshopWithOccurrences(Number(params.workshopId), {
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
      selectedSlots, // Pass the selected slots
    });

    // Process equipment bookings
    const allSelectedSlotIds = Object.values(selectedSlots).flat().map(Number);

    // Get the current user ID
    const user = await getUser(request);
    const userId = user?.id || 1; // Default to 1 if no user found

    try {
      // Get valid slot IDs (positive numbers only)
      const validSelectedSlotIds = allSelectedSlotIds.filter((id) => id > 0);

      if (validSelectedSlotIds.length > 0) {
        // Update equipment bookings
        await bulkBookEquipment(
          Number(params.workshopId),
          validSelectedSlotIds,
          userId
        );
      }

      // Update equipment slots for all occurrences
      // Process equipment bookings
      if (parsed.data.occurrences) {
        for (const occurrence of parsed.data.occurrences) {
          if (occurrence.id && parsed.data.equipments) {
            for (const equipmentId of parsed.data.equipments) {
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
                // Continue with other equipment instead of failing completely
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error updating equipment bookings:", error);
      // Continue with redirect even if equipment booking fails
    }
  } catch (error) {
    console.error("Error updating workshop:", error);
    return { errors: { database: ["Failed to update workshop"] } };
  }

  return redirect("/dashboard/admin");
}

/* ──────────────────────────────────────────────────────────────────────────────
   3) Local helpers for datetime-local fields
   ---------------------------------------------------------------------------*/
function parseDateTimeAsLocal(value: string): Date {
  if (!value) return new Date("");
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function formatLocalDatetime(date: Date): string {
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Check if a date is in the past
 */
function isDateInPast(date: Date): boolean {
  const now = new Date();
  return date < now && !isNaN(date.getTime());
}

/**
 * Check if any occurrence dates are in the past
 */
function hasOccurrencesInPast(occurrences: Occurrence[]): boolean {
  // Only check active occurrences with valid dates
  const activeOccurrences = occurrences.filter(
    (occ) => occ.status === "active" || !occ.status // Include new occurrences with no status
  );

  return activeOccurrences.some(
    (occ) =>
      (isDateInPast(occ.startDate) || isDateInPast(occ.endDate)) &&
      !isNaN(occ.startDate.getTime()) &&
      !isNaN(occ.endDate.getTime())
  );
}

const getOfferIdColor = (offerId: number | null | undefined): string => {
  if (!offerId) return "bg-gray-100 text-gray-800"; // Default color for null/undefined

  // Create a set of predefined colors to cycle through based on offerId
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800",
    "bg-yellow-100 text-yellow-800",
    "bg-orange-100 text-orange-800",
    "bg-teal-100 text-teal-800",
  ];

  // Use modulo to cycle through colors for different offerIds
  return colors[(offerId - 1) % colors.length];
};

/**
 * Get equipment slots for workshop occurrences
 */
function getEquipmentSlotsForOccurrences(occurrences: Occurrence[]): {
  [day: string]: string[];
} {
  const slotsForOccurrences: { [day: string]: string[] } = {};

  occurrences.forEach((occ) => {
    if (isNaN(occ.startDate.getTime()) || isNaN(occ.endDate.getTime())) {
      return; // Skip invalid dates
    }

    // Create 30-minute slots for the entire workshop duration
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

/**
 * Check for equipment booking overlaps
 */
function checkForEquipmentOverlaps(
  currentOccurrences: Occurrence[],
  currentSelectedEquipments: number[],
  currentAvailableEquipments: {
    id: number;
    name: string;
    slotsByDay: SlotsByDay;
  }[],
  workshopName: string
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
            equipment.slotsByDay[dayKey][timeKey].reservedForWorkshop) &&
          // Skip slots reserved for this workshop
          !equipment.slotsByDay[dayKey][timeKey].workshopName?.includes(
            workshopName
          )
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

/* ──────────────────────────────────────────────────────────────────────────────
   4) Other functions
   ---------------------------------------------------------------------------*/

function handleCancelOccurrence(occurrenceId?: number) {
  if (!occurrenceId) return;

  // Set the hidden input's value.
  const cancelInput = document.getElementById(
    "cancelOccurrenceId"
  ) as HTMLInputElement;
  if (cancelInput) {
    cancelInput.value = occurrenceId.toString();
  }

  // Use the native submit() method to trigger the form submission.
  const formEl = document.querySelector("form") as HTMLFormElement;
  formEl?.submit();
}

/* ──────────────────────────────────────────────────────────────────────────────
   5) The EditWorkshop component
   ---------------------------------------------------------------------------*/
export default function EditWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  // const workshop = useLoaderData<typeof loader>();
  const { workshop, availableWorkshops, availableEquipments, userCounts } =
    useLoaderData<Awaited<ReturnType<typeof loader>>>();

  // Convert DB's existing occurrences (UTC) to local Date objects (NOT DOING THIS ANYMORE)
  const initialOccurrences =
    workshop.occurrences?.map((occ: any) => {
      const localStart = new Date(occ.startDate);
      const localEnd = new Date(occ.endDate);
      return {
        id: occ.id,
        startDate: localStart,
        endDate: localEnd,
        status: occ.status,
        userCount: occ.userWorkshops?.length ?? 0,
        connectId: occ.connectId,
        offerId: occ.offerId, // Add this line
      };
    }) || [];

  const defaultContinuation =
    initialOccurrences.some((occ) => occ.connectId != null) || false;

  // React Hook Form setup
  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: {
      name: workshop.name,
      description: workshop.description,
      price: workshop.price,
      location: workshop.location,
      capacity: workshop.capacity,
      // type: (workshop.type as "workshop" | "orientation") || "workshop",
      occurrences: initialOccurrences,
      // This checks if workshop.prerequisites is an array of objects (with a prerequisiteId property) and maps them to numbers; otherwise, it uses the array as is (or defaults to an empty array).
      prerequisites:
        (Array.isArray(workshop.prerequisites) &&
        typeof workshop.prerequisites[0] === "object"
          ? workshop.prerequisites.map((p: any) => p.prerequisiteId)
          : workshop.prerequisites) || [],
      equipments:
        Array.isArray(workshop.equipments) &&
        typeof workshop.equipments[0] === "object"
          ? workshop.equipments.map((e: any) => e.equipmentId)
          : workshop.equipments || [],
      isWorkshopContinuation: defaultContinuation,
    },
  });

  // We store occurrences in local state for the UI
  const [occurrences, setOccurrences] =
    useState<Occurrence[]>(initialOccurrences);

  const activeOccurrences = occurrences.filter(
    (occ) => occ.status === "active"
  );
  const pastOccurrences = occurrences.filter((occ) => occ.status === "past");
  const cancelledOccurrences = occurrences.filter(
    (occ) => occ.status === "cancelled"
  );

  // New state for prerequisites – initialize from the workshop data.
  // This checks if workshop.prerequisites is an array of objects (with a prerequisiteId property) and maps them to numbers; otherwise, it uses the array as is (or defaults to an empty array).
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<number[]>(
    Array.isArray(workshop.prerequisites) &&
      workshop.prerequisites.length &&
      typeof workshop.prerequisites[0] === "object"
      ? workshop.prerequisites.map((p: any) => p.prerequisiteId)
      : workshop.prerequisites || []
  );

  const [selectedEquipments, setSelectedEquipments] = useState<number[]>(
    Array.isArray(workshop.equipments) &&
      typeof workshop.equipments[0] === "object"
      ? workshop.equipments.map((e: any) => e.equipmentId)
      : workshop.equipments || []
  );

  const [selectedSlotsMap, setSelectedSlotsMap] = useState<
    Record<number, number[]>
  >(useLoaderData<typeof loader>().selectedSlotsMap || {});
  const [equipmentOverlaps, setEquipmentOverlaps] = useState<
    {
      equipmentId: number;
      name: string;
      overlappingTimes: string[];
    }[]
  >([]);
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const [proceedDespiteOverlaps, setProceedDespiteOverlaps] = useState(false);

  const [isWorkshopContinuation, setIsWorkshopContinuation] =
    useState<boolean>(defaultContinuation);

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Let's track the date selection approach (custom, weekly, monthly).
  // Default to "custom" if we already have occurrences, but you can tweak if desired.
  const [dateSelectionType, setDateSelectionType] = useState<
    "custom" | "weekly" | "monthly"
  >(occurrences.length ? "custom" : "custom");

  // Weekly repetition states
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [weeklyCount, setWeeklyCount] = useState(1);
  const [weeklyStartDate, setWeeklyStartDate] = useState("");
  const [weeklyEndDate, setWeeklyEndDate] = useState("");

  // Monthly repetition states
  const [monthlyInterval, setMonthlyInterval] = useState(1);
  const [monthlyCount, setMonthlyCount] = useState(1);
  const [monthlyStartDate, setMonthlyStartDate] = useState("");
  const [monthlyEndDate, setMonthlyEndDate] = useState("");

  // For custom approach, add an empty row
  // For custom approach, add an empty row
  const addOccurrence = () => {
    // Check if any users are registered
    let hasUsers = false;

    if (isWorkshopContinuation) {
      // For workshop continuation, check total users across all occurrences
      hasUsers = userCounts.totalUsers > 0;
    } else {
      // For regular workshops, check each occurrence
      hasUsers = occurrences.some((occ) => occ.userCount && occ.userCount > 0);
    }

    // If users are registered, show confirmation dialog
    if (hasUsers) {
      const confirmed = window.confirm(
        "Are you sure you want to add new dates? There are users registered."
      );
      if (!confirmed) {
        return; // Exit if the user cancels
      }
    }

    // Find the highest offerId from existing occurrences
    const offerIds = occurrences
      .map((occ) => occ.offerId || 0)
      .filter((id) => id !== null && id !== undefined);

    const highestOfferId = offerIds.length > 0 ? Math.max(...offerIds) : 1;

    // Create new occurrence with the highest offerId
    const newOccurrence = {
      startDate: new Date(""),
      endDate: new Date(""),
      offerId: highestOfferId, // Use the highest existing offerId
    };

    const updatedOccurrences = [...occurrences, newOccurrence];

    // Sort by startDate
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  };

  // For custom approach, update a row's start or end
  function updateOccurrence(
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) {
    const occurrence = occurrences[index];

    // Check if there are registered users
    if (occurrence.userCount && occurrence.userCount > 0) {
      const confirmed = window.confirm(
        "Are you sure about changing the date? Users are registered here."
      );
      if (!confirmed) {
        return; // Exit if the user cancels
      }
    }

    const now = new Date();
    const localDate = parseDateTimeAsLocal(value);
    const updatedOccurrences = [...occurrences];

    // Update the chosen field
    updatedOccurrences[index][field] = localDate;

    // If it's not already cancelled, compute a new status based on the start date.
    if (updatedOccurrences[index].status !== "cancelled") {
      const start = updatedOccurrences[index].startDate;
      if (!isNaN(start.getTime())) {
        updatedOccurrences[index].status = start >= now ? "active" : "past";
      }
    }

    // **Now sort** by startDate
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  }

  // Remove a row
  const removeOccurrence = (index: number) => {
    const updated = occurrences.filter((_, i) => i !== index);
    setOccurrences(updated);
    form.setValue("occurrences", updated);
  };

  // Format date for display
  const formatDateForDisplay = (date: Date): string => {
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Function to check for duplicate dates to avoid adding the same date twice
  const isDuplicateDate = (newDate: Date, existingDates: Date[]): boolean => {
    return existingDates.some(
      (existingDate) => existingDate.getTime() === newDate.getTime()
    );
  };

  // Helper functions for prerequisites.
  const handlePrerequisiteSelect = (workshopId: number) => {
    let updated: number[];
    if (selectedPrerequisites.includes(workshopId)) {
      updated = selectedPrerequisites.filter((id) => id !== workshopId);
    } else {
      updated = [...selectedPrerequisites, workshopId];
    }
    updated.sort((a, b) => a - b);
    setSelectedPrerequisites(updated);
    form.setValue("prerequisites", updated);
  };

  const removePrerequisite = (workshopId: number) => {
    const updated = selectedPrerequisites.filter((id) => id !== workshopId);
    setSelectedPrerequisites(updated);
    form.setValue("prerequisites", updated);
  };

  // const handleEquipmentSelect = (id: number) => {
  //   const updated = selectedEquipments.includes(id)
  //     ? selectedEquipments.filter((e) => e !== id)
  //     : [...selectedEquipments, id];
  //   setSelectedEquipments(updated);
  //   form.setValue("equipments", updated);
  // };
  const handleEquipmentSelect = (id: number) => {
    // If already included, remove it; otherwise add it (but prevent duplicates)
    const updated = selectedEquipments.includes(id)
      ? selectedEquipments.filter((e) => e !== id)
      : [...new Set([...selectedEquipments, id])]; // Use Set to ensure no duplicates

    setSelectedEquipments(updated);
    form.setValue("equipments", updated);
  };

  const removeEquipment = (id: number) => {
    const updated = selectedEquipments.filter((e) => e !== id);
    setSelectedEquipments(updated);
    form.setValue("equipments", updated);
  };

  const getTotalUsersForContinuation = () => {
    return userCounts.totalUsers;
  };

  const getUniqueUsersCount = () => {
    return userCounts.uniqueUsers;
  };

  function getSlotStringsForOccurrences(
    equipmentId: number,
    occurrences: Occurrence[]
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

  // const handleFormSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();

  //   // Check for active occurrences that have past dates
  //   const pastActiveOccurrences = occurrences.filter(
  //     (occ) =>
  //       occ.status === "active" &&
  //       (isDateInPast(occ.startDate) || isDateInPast(occ.endDate)) &&
  //       !isNaN(occ.startDate.getTime()) &&
  //       !isNaN(occ.endDate.getTime())
  //   );

  //   if (pastActiveOccurrences.length > 0) {
  //     // We found active occurrences with past dates, show confirmation dialog
  //     setIsConfirmDialogOpen(true);
  //     console.log("Found past dates, showing confirmation dialog");
  //     return; // Important: prevent form submission until user confirms
  //   } else {
  //     // No past dates in active occurrences, proceed with submission
  //     console.log("No past dates found, submitting form");
  //     setFormSubmitting(true);
  //     const formElement = e.currentTarget as HTMLFormElement;
  //     formElement.submit();
  //   }
  // };
  // Replace the existing handleFormSubmit function
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit triggered");

    try {
      // Check for equipment overlaps first
      const overlaps = checkForEquipmentOverlaps(
        occurrences,
        selectedEquipments,
        useLoaderData<typeof loader>().equipments,
        workshop.name
      );

      if (overlaps.length > 0 && !proceedDespiteOverlaps) {
        console.log("Equipment overlaps detected:", overlaps);
        setEquipmentOverlaps(overlaps);
        setShowOverlapConfirm(true);
        return; // Stop form submission
      }

      // Reset overlap flag after using it
      if (proceedDespiteOverlaps) {
        setProceedDespiteOverlaps(false);
      }

      // Check for active occurrences that have past dates
      const pastActiveOccurrences = occurrences.filter(
        (occ) =>
          occ.status === "active" &&
          (isDateInPast(occ.startDate) || isDateInPast(occ.endDate)) &&
          !isNaN(occ.startDate.getTime()) &&
          !isNaN(occ.endDate.getTime())
      );

      if (pastActiveOccurrences.length > 0) {
        // We found active occurrences with past dates, show confirmation dialog
        console.log("Found past dates, showing confirmation dialog");
        setIsConfirmDialogOpen(true);
        return; // Important: prevent form submission until user confirms
      }

      // No issues, proceed with submission
      console.log("Proceeding with form submission");
      setFormSubmitting(true);

      // Use DOM to submit the form
      document.forms[0].submit();
    } catch (error) {
      console.error("Error in form submission:", error);
      // Ensure form submits even if there's an error in our checks
      setFormSubmitting(true);
      document.forms[0].submit();
    }
  };

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
  }, [occurrences, selectedEquipments]);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">Edit Workshop</h1>

      {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post" onSubmit={handleFormSubmit}>
          {/* Basic Workshop Fields */}
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
            component={Textarea}
            className="w-full" // override if needed
            rows={5}
          />

          <GenericFormField
            control={form.control}
            name="price"
            label="Price"
            placeholder="Price"
            required
            type="number"
            error={actionData?.errors?.price}
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
            type="number"
            error={actionData?.errors?.capacity}
          />

          {/* "Is Workshop Continuation" Checkbox */}
          <div className="mt-6 mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
            <label className="flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isWorkshopContinuation}
                  onChange={(e) => setIsWorkshopContinuation(e.target.checked)}
                  className="sr-only peer"
                  disabled={true}
                />
                <div className="w-6 h-6 bg-white border border-gray-300 rounded-md peer-checked:bg-yellow-500 peer-checked:border-yellow-500 transition-all duration-200"></div>
                <CheckIcon className="absolute h-4 w-4 text-white top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <span className="font-small">Multi-day Workshop</span>
            </label>
            <p className="mt-2 pl-9 text-sm text-gray-500">
              If checked, it is a multi-day workshop
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
                    Edit Workshop Dates <span className="text-red-500">*</span>
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
                            const hasWarning =
                              (isStartDatePast || isEndDatePast) &&
                              occ.status !== "past" &&
                              occ.status !== "cancelled";

                            return (
                              <div key={index} style={{ width: "100%" }}>
                                <TooltipProvider>
                                  <Tooltip
                                    open={hasWarning ? undefined : false}
                                  >
                                    <TooltipTrigger asChild>
                                      <div
                                        style={{
                                          borderLeft: hasWarning
                                            ? "4px solid #f59e0b"
                                            : "none",
                                          paddingLeft: hasWarning ? "8px" : "0",
                                          width: "100%",
                                        }}
                                      >
                                        <OccurrenceRow
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
                              </div>
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

                    {/* Weekly Repetition */}
                    {dateSelectionType === "weekly" && (
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
                          updateFormOccurrences={(updatedOccurrences) =>
                            form.setValue("occurrences", updatedOccurrences)
                          }
                          parseDateTimeAsLocal={parseDateTimeAsLocal}
                          isDuplicateDate={isDuplicateDate}
                          onRevert={() => setDateSelectionType("custom")}
                        />
                      </div>
                    )}

                    {/* Monthly Repetition */}
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
                          updateFormOccurrences={(updatedOccurrences) =>
                            form.setValue("occurrences", updatedOccurrences)
                          }
                          parseDateTimeAsLocal={parseDateTimeAsLocal}
                          isDuplicateDate={isDuplicateDate}
                          onRevert={() => setDateSelectionType("custom")}
                        />
                      </div>
                    )}

                    {/* If we have generated occurrences, display them in Tabs */}
                    {occurrences.length > 0 && (
                      <>
                        <h3 className="font-medium mb-4 flex items-center">
                          <CalendarIcon className="w-5 h-5 mr-2 text-yellow-500" />
                          Workshop Dates:
                        </h3>
                        <OccurrencesTabs
                          defaultValue="active"
                          tabs={[
                            {
                              value: "active",
                              label: (
                                <span className="flex items-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Active ({activeOccurrences.length})
                                </span>
                              ),
                              triggerClassName:
                                "data-[state=active]:bg-yellow-500 data-[state=active]:text-white font-medium",
                              content:
                                activeOccurrences.length > 0 ? (
                                  <div className="space-y-3">
                                    {activeOccurrences.map((occ, index) => {
                                      const originalIndex =
                                        occurrences.findIndex(
                                          (o) =>
                                            o.startDate.getTime() ===
                                              occ.startDate.getTime() &&
                                            o.endDate.getTime() ===
                                              occ.endDate.getTime()
                                        );
                                      const hasUsers =
                                        occ.userCount && occ.userCount > 0;

                                      // For workshop continuations, we'll display user count and cancel button only on the first occurrence
                                      const isFirstActiveOccurrence =
                                        index === 0;
                                      const shouldShowUserCount =
                                        !isWorkshopContinuation ||
                                        isFirstActiveOccurrence;
                                      const shouldShowCancelButton =
                                        !isWorkshopContinuation ||
                                        isFirstActiveOccurrence;

                                      return (
                                        <div
                                          key={index}
                                          className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200"
                                        >
                                          <div className="text-sm">
                                            <div className="font-medium text-green-700 flex items-center">
                                              <span>
                                                {formatDateForDisplay(
                                                  occ.startDate
                                                )}
                                              </span>
                                              {occ.offerId && (
                                                <span
                                                  className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOfferIdColor(
                                                    occ.offerId
                                                  )}`}
                                                >
                                                  Offer #{occ.offerId}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              to{" "}
                                              {formatDateForDisplay(
                                                occ.endDate
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center">
                                            {shouldShowUserCount && (
                                              <div className="flex items-center mr-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                                                <span className="flex items-center text-sm font-medium text-blue-700">
                                                  <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-4 w-4 mr-1"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={2}
                                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                    />
                                                  </svg>
                                                  {isWorkshopContinuation
                                                    ? `${
                                                        userCounts.totalUsers
                                                      } ${
                                                        userCounts.totalUsers ===
                                                        1
                                                          ? "user"
                                                          : "users"
                                                      } registered`
                                                    : `${occ.userCount ?? 0} ${
                                                        occ.userCount === 1 ||
                                                        occ.userCount ===
                                                          undefined
                                                          ? "user"
                                                          : "users"
                                                      } registered`}
                                                </span>
                                              </div>
                                            )}
                                            {shouldShowCancelButton ? (
                                              hasUsers ||
                                              (isWorkshopContinuation &&
                                                userCounts.totalUsers > 0) ? (
                                                <ConfirmButton
                                                  confirmTitle={
                                                    isWorkshopContinuation
                                                      ? "Cancel All Occurrences"
                                                      : "Cancel Occurrence"
                                                  }
                                                  confirmDescription={
                                                    isWorkshopContinuation
                                                      ? "Are you sure you want to cancel all occurrences for this workshop? This action cannot be undone."
                                                      : "Are you sure you want to cancel this occurrence? This action cannot be undone."
                                                  }
                                                  onConfirm={() => {
                                                    if (
                                                      isWorkshopContinuation
                                                    ) {
                                                      // Cancel all active occurrences for workshop continuations
                                                      activeOccurrences.forEach(
                                                        (occurrence) => {
                                                          if (occurrence.id) {
                                                            handleCancelOccurrence(
                                                              occurrence.id
                                                            );
                                                          }
                                                        }
                                                      );
                                                    } else {
                                                      // Cancel just this occurrence for regular workshops
                                                      handleCancelOccurrence(
                                                        occ.id
                                                      );
                                                    }
                                                  }}
                                                  buttonLabel={
                                                    isWorkshopContinuation
                                                      ? "Cancel All"
                                                      : "Cancel"
                                                  }
                                                  buttonClassName="bg-blue-500 hover:bg-blue-600 text-white h-8 px-3 rounded-full"
                                                />
                                              ) : (
                                                <ConfirmButton
                                                  confirmTitle={
                                                    isWorkshopContinuation
                                                      ? "Delete All Occurrences"
                                                      : "Delete Occurrence"
                                                  }
                                                  confirmDescription={
                                                    isWorkshopContinuation
                                                      ? "Are you sure you want to delete all occurrences for this workshop? This action cannot be undone."
                                                      : "Are you sure you want to delete this occurrence?"
                                                  }
                                                  onConfirm={() => {
                                                    if (
                                                      isWorkshopContinuation
                                                    ) {
                                                      // Create a new array without any of the active occurrences
                                                      const remainingOccurrences =
                                                        occurrences.filter(
                                                          (occ) =>
                                                            occ.status !==
                                                            "active"
                                                        );
                                                      // Set the new filtered array of occurrences
                                                      setOccurrences(
                                                        remainingOccurrences
                                                      );
                                                      form.setValue(
                                                        "occurrences",
                                                        remainingOccurrences
                                                      );
                                                    } else {
                                                      // Remove just this occurrence
                                                      removeOccurrence(
                                                        originalIndex
                                                      );
                                                    }
                                                  }}
                                                  buttonLabel={
                                                    isWorkshopContinuation
                                                      ? "Delete All"
                                                      : "X"
                                                  }
                                                  buttonClassName="bg-red-500 hover:bg-red-600 text-white h-8 px-3 rounded-full"
                                                />
                                              )
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-12 w-12 mb-3 text-gray-400"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                      />
                                    </svg>
                                    No active workshop dates scheduled
                                  </div>
                                ),
                            },
                            {
                              value: "past",
                              label: (
                                <span className="flex items-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Past ({pastOccurrences.length})
                                </span>
                              ),
                              triggerClassName:
                                "data-[state=active]:bg-gray-500 data-[state=active]:text-white font-medium",
                              content:
                                pastOccurrences.length > 0 ? (
                                  <div className="space-y-3 px-4">
                                    {pastOccurrences.map((occ, index) => {
                                      const originalIndex =
                                        occurrences.findIndex(
                                          (o) =>
                                            o.startDate.getTime() ===
                                              occ.startDate.getTime() &&
                                            o.endDate.getTime() ===
                                              occ.endDate.getTime()
                                        );
                                      return (
                                        <div
                                          key={index}
                                          className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 border-l-4 border-l-amber-500 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200"
                                        >
                                          <div className="text-sm">
                                            <div className="font-medium text-gray-700 flex items-center">
                                              <span>
                                                {formatDateForDisplay(
                                                  occ.startDate
                                                )}
                                              </span>
                                              <Badge
                                                variant="outline"
                                                className="ml-2 bg-amber-100 text-amber-800 border-amber-300 text-xs"
                                              >
                                                Past Date
                                              </Badge>
                                              {occ.offerId && (
                                                <span
                                                  className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOfferIdColor(
                                                    occ.offerId
                                                  )}`}
                                                >
                                                  Offer #{occ.offerId}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              to{" "}
                                              {formatDateForDisplay(
                                                occ.endDate
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center mr-2 px-3 py-1 bg-gray-100 border border-gray-300 rounded-full">
                                            <span className="flex items-center text-sm font-medium text-gray-700">
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                              </svg>
                                              {occ.userCount ?? 0}{" "}
                                              {occ.userCount === 1 ||
                                              occ.userCount === undefined
                                                ? "user"
                                                : "users"}{" "}
                                              registered
                                            </span>
                                          </div>
                                          <ConfirmButton
                                            confirmTitle="Delete Occurrence"
                                            confirmDescription="Are you sure you want to delete this occurrence?"
                                            onConfirm={() =>
                                              removeOccurrence(originalIndex)
                                            }
                                            buttonLabel="X"
                                            buttonClassName="bg-red-500 hover:bg-red-600 text-white h-8 px-3 rounded-full"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-gray-500">
                                    No past workshop dates
                                  </div>
                                ),
                            },
                            {
                              value: "cancelled",
                              label: (
                                <span className="flex items-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                  Cancelled ({cancelledOccurrences.length})
                                </span>
                              ),
                              triggerClassName:
                                "data-[state=active]:bg-red-500 data-[state=active]:text-white font-medium",
                              content:
                                cancelledOccurrences.length > 0 ? (
                                  <div className="space-y-3">
                                    {cancelledOccurrences.map((occ, index) => {
                                      const originalIndex =
                                        occurrences.findIndex(
                                          (o) =>
                                            o.startDate.getTime() ===
                                              occ.startDate.getTime() &&
                                            o.endDate.getTime() ===
                                              occ.endDate.getTime()
                                        );
                                      return (
                                        <div
                                          key={index}
                                          className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200"
                                        >
                                          <div className="text-sm">
                                            <div className="font-medium text-red-700 flex items-center">
                                              <span>
                                                {formatDateForDisplay(
                                                  occ.startDate
                                                )}
                                              </span>
                                              {occ.offerId && (
                                                <span
                                                  className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOfferIdColor(
                                                    occ.offerId
                                                  )}`}
                                                >
                                                  Offer #{occ.offerId}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              to{" "}
                                              {formatDateForDisplay(
                                                occ.endDate
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center mr-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
                                            <span className="flex items-center text-sm font-medium text-red-700">
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                              </svg>
                                              {occ.userCount ?? 0}{" "}
                                              {occ.userCount === 1 ||
                                              occ.userCount === undefined
                                                ? "user"
                                                : "users"}{" "}
                                              registered
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-gray-500">
                                    No cancelled workshop dates
                                  </div>
                                ),
                            },
                          ]}
                        />
                      </>
                    )}
                  </div>
                </FormControl>
                <FormMessage>{actionData?.errors?.occurrences}</FormMessage>
              </FormItem>
            )}
          />

          {/* Prerequisites */}
          {workshop.type !== "orientation" ? (
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
              filterFn={(item) =>
                item.type.toLowerCase() === "orientation" &&
                item.id !== workshop.id
              }
            />
          ) : (
            <div className="mt-4 mb-4 text-gray-500 text-center text-sm">
              This is an orientation and does not have prerequisites.
            </div>
          )}

          {/* Equipments */}
          <MultiSelectField
            control={form.control}
            name="equipments"
            label="Equipments"
            options={availableEquipments}
            selectedItems={selectedEquipments}
            onSelect={handleEquipmentSelect}
            onRemove={removeEquipment}
            error={actionData?.errors?.equipments}
            placeholder="Select equipments..."
            helperText="Choose equipment required for this workshop/orientation."
          />

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
                defaultValue={
                  [...new Set(selectedEquipments)]
                    .sort((a, b) => a - b)[0]
                    ?.toString() || ""
                }
                className="w-full"
              >
                <TabsList className="mb-4">
                  {[...new Set(selectedEquipments)]
                    .sort((a, b) => a - b)
                    .map((equipmentId) => {
                      const equipment = useLoaderData<
                        typeof loader
                      >().equipments.find((eq: any) => eq.id === equipmentId);
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

                {[...new Set(selectedEquipments)]
                  .sort((a, b) => a - b)
                  .map((equipmentId) => {
                    const equipment = useLoaderData<
                      typeof loader
                    >().equipments.find((eq: any) => eq.id === equipmentId);

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
                          visibleDays={
                            useLoaderData<typeof loader>()
                              .equipmentVisibilityDays
                          }
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

          <input
            type="hidden"
            name="occurrences"
            value={JSON.stringify(
              occurrences.map((occ) => ({
                id: occ.id,
                startDate: occ.startDate,
                endDate: occ.endDate,
                startDatePST: occ.startDatePST,
                endDatePST: occ.endDatePST,
                status: occ.status,
                userCount: occ.userCount,
                offerId: occ.offerId,
              }))
            )}
          />
          <input type="hidden" name="type" value={workshop.type} />
          <input
            type="hidden"
            id="cancelOccurrenceId"
            name="cancelOccurrenceId"
            value=""
          />
          <input
            type="hidden"
            name="prerequisites"
            value={JSON.stringify(
              [...selectedPrerequisites].sort((a, b) => a - b)
            )}
          />
          <input
            type="hidden"
            name="equipments"
            value={JSON.stringify(selectedEquipments || [])}
          />
          <input
            type="hidden"
            name="isWorkshopContinuation"
            value={isWorkshopContinuation ? "true" : "false"}
          />

          <input
            type="hidden"
            name="selectedSlots"
            value={JSON.stringify(selectedSlotsMap)}
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
                <AlertDialogAction
                  onClick={() => {
                    // Set flag to proceed despite overlaps
                    setProceedDespiteOverlaps(true);
                    setShowOverlapConfirm(false);

                    // Submit the form after a brief delay to ensure state updates
                    setTimeout(() => {
                      console.log("Proceeding despite overlaps");
                      document.forms[0].submit();
                    }, 50);
                  }}
                >
                  Proceed Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirmation Dialog for Past Dates */}
          <AlertDialog
            open={isConfirmDialogOpen}
            onOpenChange={(open) => {
              setIsConfirmDialogOpen(open);
              // If dialog is closed without submitting, reset the submitting state
              if (!open) {
                setFormSubmitting(false);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Warning: Past Workshop Dates
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Some of your workshop dates are in the past. Are you sure you
                  want to save a workshop with past dates?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setFormSubmitting(false)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    console.log("User confirmed to proceed with past dates");
                    setFormSubmitting(true);
                    // Use setTimeout to ensure React state updates before form submission
                    setTimeout(() => {
                      const formElement = document.querySelector(
                        "form"
                      ) as HTMLFormElement;
                      if (formElement) {
                        console.log("Submitting form after confirmation");
                        formElement.submit();
                      }
                    }, 50);
                  }}
                >
                  Proceed Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* <Button
            type="submit"
            className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
            disabled={formSubmitting}
            onClick={() => {
              console.log("Submit button clicked");
              console.log(
                "Occurrences with past dates:",
                occurrences.filter(
                  (occ) =>
                    occ.status === "active" &&
                    (isDateInPast(occ.startDate) || isDateInPast(occ.endDate))
                )
              );
            }}
          >
            Update Workshop
          </Button> */}
          <Button
            type="submit"
            className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
            disabled={formSubmitting}
          >
            {formSubmitting ? "Updating..." : "Update Workshop"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
