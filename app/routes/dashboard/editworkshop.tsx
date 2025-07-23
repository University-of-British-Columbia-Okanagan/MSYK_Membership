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
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import GenericFormField from "~/components/ui/Dashboard/GenericFormField";
import DateTypeRadioGroup from "~/components/ui/Dashboard/DateTypeRadioGroup";
import OccurrenceRow from "~/components/ui/Dashboard/OccurrenceRow";
import RepetitionScheduleInputs from "~/components/ui/Dashboard/RepetitionScheduleInputs";
import OccurrencesTabs from "~/components/ui/Dashboard/OccurrenceTabs";
import PrerequisitesField from "~/components/ui/Dashboard/PrerequisitesField";
import { getAvailableEquipment } from "~/models/equipment.server";
import MultiSelectField from "~/components/ui/Dashboard/MultiSelectField";
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
import { getUser, getRoleUser } from "~/utils/session.server";
import EquipmentBookingGrid from "@/components/ui/Dashboard/equipmentbookinggrid";
import type { SlotsByDay } from "@/components/ui/Dashboard/equipmentbookinggrid";
import { db } from "~/utils/db.server";
import { logger } from "~/logging/logger";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

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
  const workshopId = Number(params.workshopId);
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    logger.info("Workshop not found", {
      url: request.url,
    });
    throw new Response("Workshop Not Found", { status: 404 });
  }

  const availableWorkshops = await getWorkshops();
  const availableEquipments = await getAvailableEquipment();
  const userCounts = await getWorkshopContinuationUserCount(workshopId);

  // Get user ID from session if available (for equipment booking UI)
  const user = await getUser(request);
  const roleUser = await getRoleUser(request);
  const userId = user?.id || undefined;

  // Get equipment slots and visibility days
  const equipmentsWithSlots = await getEquipmentSlotsWithStatus(userId, true);
  const equipmentVisibilityDays = await getEquipmentVisibilityDays();

  // Create a mapping of selected equipment slots
  const selectedSlotsMap: Record<number, number[]> = {};
  for (const equipment of equipmentsWithSlots) {
    const selectedSlotIds: number[] = [];
    for (const day in equipment.slotsByDay) {
      for (const time in equipment.slotsByDay[day]) {
        const slot = equipment.slotsByDay[day][time];
        // Enhanced check - only include slots that are specifically reserved for THIS workshop
        if (
          slot?.reservedForWorkshop &&
          slot?.id &&
          slot.workshopName === workshop.name &&
          slot.workshopOccurrenceId // Make sure it's actually tied to a workshop occurrence
        ) {
          // Additional check: verify the slot belongs to one of this workshop's occurrences
          const belongsToThisWorkshop = workshop.occurrences?.some(
            (occ: any) => occ.id === slot.workshopOccurrenceId
          );

          if (belongsToThisWorkshop) {
            selectedSlotIds.push(slot.id);
          }
        }
      }
    }
    if (selectedSlotIds.length > 0) {
      selectedSlotsMap[equipment.id] = selectedSlotIds;
    }
  }

  return {
    workshop,
    availableWorkshops,
    availableEquipments,
    userCounts,
    equipments: equipmentsWithSlots,
    selectedSlotsMap,
    equipmentVisibilityDays,
    roleUser,
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
  const roleUser = await getRoleUser(request);

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`[User: ${roleUser?.userId ?? "unknown"}] Not authorized to update workshop`, {
      url: request.url,
    });
    throw new Response("Not Authorized", { status: 419 });
  }

  // Check if this submission is a cancellation request.
  if (rawValues.cancelOccurrenceId) {
    const occurrenceId = parseInt(rawValues.cancelOccurrenceId as string, 10);
    const isWorkshopContinuation = rawValues.isWorkshopContinuation === "true";

    try {
      if (isWorkshopContinuation) {
        const workshop = await getWorkshopById(Number(params.workshopId));
        const activeOccurrences = workshop.occurrences.filter(
          (occ: any) => occ.status === "active"
        );

        for (const occ of activeOccurrences) {
          await cancelWorkshopOccurrence(occ.id);
        }

        logger.info(
          `[User: ${roleUser.userId}] Cancelled all active occurrences for workshop ${params.workshopId} (continuation)`,
          { url: request.url }
        );
      } else {
        await cancelWorkshopOccurrence(occurrenceId);

        logger.info(
          `[User: ${roleUser.userId}] Cancelled occurrence ${occurrenceId} for workshop ${params.workshopId}`,
          { url: request.url }
        );
      }
    } catch (error: any) {
      logger.error(
        `[User: ${roleUser.userId}] Error cancelling occurrence(s): ${error.message}`,
        { url: request.url }
      );
      return { errors: { cancel: ["Failed to cancel occurrence(s)"] } };
    }
    return redirect("/dashboard/admin");
  }

  let selectedSlots: Record<number, number[]> = {};
  try {
    selectedSlots = JSON.parse(rawValues.selectedSlots as string);
  } catch (error: any) {
    logger.error(
      `[User: ${roleUser.userId}] Error parsing selected slots: ${error.message}`,
      { url: request.url }
    );
    return { errors: { selectedSlots: ["Invalid selected slots format"] } };
  }

  // Convert price & capacity
  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);
  const prerequisites = JSON.parse(rawValues.prerequisites as string).map(Number);
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
  } catch (error: any) {
    logger.error(
      `[User: ${roleUser.userId}] Error parsing occurrences: ${error.message}`,
      { url: request.url }
    );
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
    logger.warn(
      `[User: ${roleUser.userId}] Validation errors: ${JSON.stringify(
        parsed.error.flatten().fieldErrors
      )}`,
      { url: request.url }
    );
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    // Get the current workshop data to compare with changes
    const currentWorkshop = await getWorkshopById(Number(params.workshopId));
    const currentOccurrences = currentWorkshop.occurrences || [];
    
    // Get the current user ID
    const user = await getUser(request);
    const userId = user?.id || 1;

    // Enhanced cleanup - also clean up orphaned slots
    if (parsed.data.equipments && parsed.data.equipments.length > 0) {
      // Find equipment slots that belong to this workshop's occurrences
      for (const occurrence of currentOccurrences) {
        if (occurrence.id) {
          try {
              // Delete old equipment bookings for this occurrence
            await db.equipmentBooking.deleteMany({
              where: {
                workshopId: Number(params.workshopId),
                slot: {
                  workshopOccurrenceId: occurrence.id,
                },
              },
            });

            // Reset equipment slots that were assigned to this occurrence
            await db.equipmentSlot.updateMany({
              where: {
                workshopOccurrenceId: occurrence.id,
              },
              data: {
                isBooked: false,
                workshopOccurrenceId: null,
              },
            });
          } catch (error: any) {
            logger.error(
              `[User: ${roleUser.userId}] Error cleaning old slots for occurrence ${occurrence.id}: ${error.message}`,
              { url: request.url }
            );
          }
        }
      }

      // COPY PASTE: Additional cleanup - remove any orphaned bookings for this workshop
      try {
        await db.equipmentBooking.deleteMany({
          where: {
            workshopId: Number(params.workshopId),
            bookedFor: "workshop",
          },
        });
      } catch (error: any) {
        logger.error(
          `[User: ${roleUser.userId}] Error cleaning orphaned workshop bookings: ${error.message}`,
          { url: request.url }
        );
      }
    }

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
      userId, // Pass the user ID
    });

    // COPY PASTE: Process equipment bookings for the NEW occurrences
    if (parsed.data.equipments && parsed.data.equipments.length > 0) {
      // Get the updated workshop with new occurrence IDs
      const updatedWorkshop = await getWorkshopById(Number(params.workshopId));

      for (const occurrence of updatedWorkshop.occurrences) {
        if (occurrence.id) {
          for (const equipmentId of parsed.data.equipments) {
            try {
              await createEquipmentSlotsForOccurrence(
                occurrence.id,
                equipmentId,
                occurrence.startDate,
                occurrence.endDate,
                userId
              );
            } catch (error: any) {
              logger.error(
                `[User: ${roleUser.userId}] Error creating slots for equipment ${equipmentId} in occurrence ${occurrence.id}: ${error.message}`,
                { url: request.url }
              );
            }
          }
        }
      }
    }

    const allSelectedSlotIds = Object.values(selectedSlots).flat().map(Number);
    const validSelectedSlotIds = allSelectedSlotIds.filter((id) => id > 0);

    if (validSelectedSlotIds.length > 0) {
      try {
        await bulkBookEquipment(Number(params.workshopId), validSelectedSlotIds, userId);
      } catch (error: any) {
        logger.error(
          `[User: ${roleUser.userId}] Error updating manually selected equipment bookings: ${error.message}`,
          { url: request.url }
        );
      }
    }
  } catch (error: any) {
    logger.error(
      `[User: ${roleUser.userId}] Error updating workshop: ${error.message}`,
      { url: request.url }
    );
    return { errors: { database: ["Failed to update workshop"] } };
  }

  logger.info(`[User: ${roleUser.userId}] Successfully updated workshop ${params.workshopId}`, {
    url: request.url,
  });

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
    overlappingTimes: {
      time: string;
      conflictType: "workshop" | "user" | "unknown";
      conflictName: string;
    }[];
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

    const overlappingTimes: {
      time: string;
      conflictType: "workshop" | "user" | "unknown";
      conflictName: string;
    }[] = [];

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
        const slot = equipment.slotsByDay[dayKey]?.[timeKey];
        if (
          slot &&
          (slot.isBooked || slot.reservedForWorkshop) &&
          // Skip slots reserved for this workshop
          !(slot as any).workshopName?.includes(workshopName)
        ) {
          // Calculate end time (30 minutes later)
          const endTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
          const endHours = String(endTime.getHours()).padStart(2, "0");
          const endMinutes = String(endTime.getMinutes()).padStart(2, "0");

          const formattedTime = `${dayName} ${dayNumber} at ${hours}:${minutes} - ${endHours}:${endMinutes}`;

          // COPY PASTE: Enhanced conflict detection logic
          // Determine conflict type and name using available properties
          let conflictType: "workshop" | "user" | "unknown" = "unknown";
          let conflictName = "Unknown booking";

          // Check if it's reserved for a workshop
          if (slot.reservedForWorkshop && (slot as any).workshopName) {
            conflictType = "workshop";
            conflictName = (slot as any).workshopName;
          }
          // Check if it's booked by a user
          else if (
            slot.isBooked &&
            (slot as any).userFirstName &&
            (slot as any).userLastName
          ) {
            conflictType = "user";
            conflictName = `${(slot as any).userFirstName} ${
              (slot as any).userLastName
            }`;
          }
          // Fallback cases
          else if (slot.reservedForWorkshop) {
            conflictType = "workshop";
            conflictName = "Workshop booking";
          } else if (slot.isBooked) {
            conflictType = "user";
            conflictName = "User booking";
          }

          // Check if this time conflict is already recorded
          const existingConflict = overlappingTimes.find(
            (ot) => ot.time === formattedTime
          );
          if (!existingConflict) {
            overlappingTimes.push({
              time: formattedTime,
              conflictType,
              conflictName,
            });
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
  const {
    workshop,
    availableWorkshops,
    availableEquipments,
    userCounts,
    roleUser,
  } = useLoaderData<Awaited<ReturnType<typeof loader>>>();

  const { equipments: equipmentsWithSlots } = useLoaderData<typeof loader>();

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
    })
    // SORT INITIAL OCCURRENCES: Sort by startDate when first loading
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()) || [];

  const defaultContinuation =
    initialOccurrences.some((occ) => occ.connectId != null) || false;

  const navigate = useNavigate();

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

  // const [selectedEquipments, setSelectedEquipments] = useState<number[]>(
  //   Array.isArray(workshop.equipments) &&
  //     typeof workshop.equipments[0] === "object"
  //     ? workshop.equipments.map((e: any) => e.equipmentId)
  //     : workshop.equipments || []
  // );
  const [selectedEquipments, setSelectedEquipments] = useState<number[]>(
    Array.isArray(workshop.equipments) &&
      typeof workshop.equipments[0] === "object"
      ? [...new Set(workshop.equipments.map((e: any) => e.equipmentId))]
      : [...new Set(workshop.equipments || [])]
  );

  const [selectedSlotsMap, setSelectedSlotsMap] = useState<
    Record<number, number[]>
  >(useLoaderData<typeof loader>().selectedSlotsMap || {});
  const [equipmentOverlaps, setEquipmentOverlaps] = useState<
    {
      equipmentId: number;
      name: string;
      overlappingTimes: {
        time: string;
        conflictType: "workshop" | "user" | "unknown";
        conflictName: string;
      }[];
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

    // Store the old dates before updating for equipment slot cleanup
    const oldStartDate = updatedOccurrences[index].startDate;
    const oldEndDate = updatedOccurrences[index].endDate;

    // Update the chosen field
    updatedOccurrences[index][field] = localDate;

    // AUTO-SET END DATE: If updating start date and it's valid, automatically set end date to 2 hours later
    if (field === "startDate" && !isNaN(localDate.getTime())) {
      const endDate = new Date(localDate.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours
      updatedOccurrences[index].endDate = endDate;
    }

    // If it's not already cancelled, compute a new status based on the start date.
    if (updatedOccurrences[index].status !== "cancelled") {
      const start = updatedOccurrences[index].startDate;
      if (!isNaN(start.getTime())) {
        updatedOccurrences[index].status = start >= now ? "active" : "past";
      }
    }

    // Clear old equipment slots from selectedSlotsMap when dates change
    if (
      selectedEquipments.length > 0 &&
      !isNaN(oldStartDate.getTime()) &&
      !isNaN(oldEndDate.getTime())
    ) {
      const newSlotsMap = { ...selectedSlotsMap };

      selectedEquipments.forEach((equipmentId) => {
        if (newSlotsMap[equipmentId]) {
          // Get the old slot strings that should be removed
          const oldSlotStrings = getSlotStringsForOccurrences(equipmentId, [
            {
              startDate: oldStartDate,
              endDate: oldEndDate,
            },
          ]);

          // Filter out old negative slot IDs (workshop date slots)
          const oldSlotCount = oldSlotStrings.length;

          // Remove the old negative slot IDs from the beginning of the array
          // (they were added as -1, -2, -3, etc.)
          const updatedSlots = newSlotsMap[equipmentId].filter((slotId) => {
            if (slotId > 0) return true; // Keep real slot IDs
            // Remove old negative IDs by checking if they fall within the old slot count range
            const negativeIndex = Math.abs(slotId);
            return negativeIndex > oldSlotCount;
          });

          newSlotsMap[equipmentId] = updatedSlots;
        }
      });

      setSelectedSlotsMap(newSlotsMap);
    }

    // **Now sort** by startDate
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  }

  // Remove a row
  // Remove a row
  const removeOccurrence = (index: number) => {
    // COPY PASTE: Clean up equipment slots for the removed occurrence
    const occurrenceToRemove = occurrences[index];
    if (
      selectedEquipments.length > 0 &&
      !isNaN(occurrenceToRemove.startDate.getTime()) &&
      !isNaN(occurrenceToRemove.endDate.getTime())
    ) {
      const newSlotsMap = { ...selectedSlotsMap };

      selectedEquipments.forEach((equipmentId) => {
        if (newSlotsMap[equipmentId]) {
          // Get the slot strings for the occurrence being removed
          const removedSlotStrings = getSlotStringsForOccurrences(equipmentId, [
            occurrenceToRemove,
          ]);
          const removedSlotCount = removedSlotStrings.length;

          // Remove corresponding negative slot IDs
          const updatedSlots = newSlotsMap[equipmentId].filter((slotId) => {
            if (slotId > 0) return true; // Keep real slot IDs
            // Remove negative IDs corresponding to this occurrence
            return false; // For simplicity, we'll regenerate all negative IDs
          });

          newSlotsMap[equipmentId] = updatedSlots;
        }
      });

      setSelectedSlotsMap(newSlotsMap);
    }

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

  const handleEquipmentSelect = (id: number) => {
    // If already included, remove it; otherwise add it (but prevent duplicates)
    const updated = selectedEquipments.includes(id)
      ? selectedEquipments.filter((e) => e !== id)
      : [...new Set([...selectedEquipments, id])]; // Use Set to ensure no duplicates

    // Make sure we deduplicate the array before setting state
    const uniqueUpdated = [...new Set(updated)];
    setSelectedEquipments(uniqueUpdated);
    form.setValue("equipments", uniqueUpdated);
  };

  const removeEquipment = (id: number) => {
    // Filter out the equipment and ensure the result is unique
    const updated = [...new Set(selectedEquipments.filter((e) => e !== id))];
    setSelectedEquipments(updated);
    form.setValue("equipments", updated);

    // COPY PASTE: Also remove this equipment from selectedSlotsMap
    const newSlotsMap = { ...selectedSlotsMap };
    delete newSlotsMap[id];
    setSelectedSlotsMap(newSlotsMap);
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit triggered");

    try {
      // Check for equipment overlaps first
      const overlaps = checkForEquipmentOverlaps(
        occurrences,
        selectedEquipments,
        equipmentsWithSlots, // FIXED: Use the equipmentsWithSlots variable
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
      // document.forms[0].submit();

      const formElement = e.currentTarget as HTMLFormElement;
      formElement.submit();
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
      // COPY PASTE: Completely regenerate the slots map to ensure accuracy
      const newSlotsMap: Record<number, number[]> = {};

      // For each equipment, add the slots from the occurrences
      selectedEquipments.forEach((equipmentId) => {
        // Get existing real slot IDs (positive numbers) for this equipment
        const existingRealSlots = (selectedSlotsMap[equipmentId] || []).filter(
          (id) => id > 0
        );

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

        // Combine existing real slots with new workshop slots
        newSlotsMap[equipmentId] = [...existingRealSlots, ...newSlotIds];
      });

      // Update the selected slots map
      setSelectedSlotsMap(newSlotsMap);
    } else if (selectedEquipments.length === 0) {
      // COPY PASTE: Clear all slots if no equipment is selected
      setSelectedSlotsMap({});
    }
  }, [occurrences, selectedEquipments]); // Remove selectedSlotsMap from dependencies to prevent infinite loop

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow overflow-auto">
          <div className="max-w-7xl mx-auto p-8 w-full">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/admin")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin Dashboard
              </Button>
            </div>
            <h1 className="text-2xl font-bold mb-8 text-center">
              Edit Workshop
            </h1>

            {actionData?.errors &&
              Object.keys(actionData.errors).length > 0 && (
                <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
                  There are some errors in your form. Please review the
                  highlighted fields below.
                </div>
              )}

            <Form {...form}>
              <form method="post" onSubmit={handleFormSubmit}>
                {/* Basic Workshop Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <GenericFormField
                    control={form.control}
                    name="name"
                    label="Name"
                    placeholder="Workshop Name"
                    required
                    error={actionData?.errors?.name}
                  />

                  {/* <GenericFormField
            control={form.control}
            name="description"
            label="Description"
            placeholder="Workshop Description"
            required
            error={actionData?.errors?.description}
            component={Textarea}
            className="w-full" // override if needed
            rows={5}
          /> */}

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
                </div>

                <div className="mb-6">
                  <GenericFormField
                    control={form.control}
                    name="description"
                    label="Description"
                    placeholder="Workshop Description"
                    required
                    error={actionData?.errors?.description}
                    component={Textarea}
                    className="w-full"
                    rows={5}
                  />
                </div>

                {/* "Is Workshop Continuation" Checkbox */}
                <div className="mt-6 mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isWorkshopContinuation}
                        onChange={(e) =>
                          setIsWorkshopContinuation(e.target.checked)
                        }
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
                          Edit Workshop Dates{" "}
                          <span className="text-red-500">*</span>
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
                                    No dates added yet. Click the button below
                                    to add workshop dates.
                                  </p>
                                </div>
                              ) : (
                                occurrences.map((occ, index) => {
                                  const isStartDatePast = isDateInPast(
                                    occ.startDate
                                  );
                                  const isEndDatePast = isDateInPast(
                                    occ.endDate
                                  );
                                  const hasWarning = isStartDatePast || isEndDatePast;

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
                                                paddingLeft: hasWarning
                                                  ? "8px"
                                                  : "0",
                                                width: "100%",
                                              }}
                                            >
                                              <OccurrenceRow
                                                index={index}
                                                occurrence={occ}
                                                updateOccurrence={
                                                  updateOccurrence
                                                }
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
                                                {isStartDatePast &&
                                                isEndDatePast
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
                                  form.setValue(
                                    "occurrences",
                                    updatedOccurrences
                                  )
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
                                  form.setValue(
                                    "occurrences",
                                    updatedOccurrences
                                  )
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
                                          {activeOccurrences.map(
                                            (occ, index) => {
                                              const originalIndex =
                                                occurrences.findIndex(
                                                  (o) =>
                                                    o.startDate.getTime() ===
                                                      occ.startDate.getTime() &&
                                                    o.endDate.getTime() ===
                                                      occ.endDate.getTime()
                                                );
                                              const hasUsers =
                                                occ.userCount &&
                                                occ.userCount > 0;

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
                                                            : `${
                                                                occ.userCount ??
                                                                0
                                                              } ${
                                                                occ.userCount ===
                                                                  1 ||
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
                                                        userCounts.totalUsers >
                                                          0) ? (
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
                                                                (
                                                                  occurrence
                                                                ) => {
                                                                  if (
                                                                    occurrence.id
                                                                  ) {
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
                                            }
                                          )}
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
                                                    removeOccurrence(
                                                      originalIndex
                                                    )
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
                                        Cancelled ({cancelledOccurrences.length}
                                        )
                                      </span>
                                    ),
                                    triggerClassName:
                                      "data-[state=active]:bg-red-500 data-[state=active]:text-white font-medium",
                                    content:
                                      cancelledOccurrences.length > 0 ? (
                                        <div className="space-y-3">
                                          {cancelledOccurrences.map(
                                            (occ, index) => {
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
                                                      occ.userCount ===
                                                        undefined
                                                        ? "user"
                                                        : "users"}{" "}
                                                      registered
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            }
                                          )}
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
                      <FormMessage>
                        {actionData?.errors?.occurrences}
                      </FormMessage>
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
                  // Ensure we're only displaying unique selected items
                  selectedItems={[...new Set(selectedEquipments)]}
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
                      <p>
                        Workshop dates are shown in green. Grid is read only.
                      </p>
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
                            >().equipments.find(
                              (eq: any) => eq.id === equipmentId
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

                      {[...new Set(selectedEquipments)]
                        .sort((a, b) => a - b)
                        .map((equipmentId) => {
                          const equipment = useLoaderData<
                            typeof loader
                          >().equipments.find(
                            (eq: any) => eq.id === equipmentId
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
                                visibleDays={
                                  useLoaderData<typeof loader>()
                                    .equipmentVisibilityDays
                                }
                                workshopSlots={getEquipmentSlotsForOccurrences(
                                  validOccurrences
                                )}
                                currentWorkshopOccurrences={validOccurrences}
                                currentWorkshopId={workshop.id}
                                currentWorkshopName={workshop.name}
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
                          Your workshop dates conflict with existing bookings
                          for the following equipment:
                        </p>
                        <div className="mt-2 space-y-2">
                          {equipmentOverlaps.map((overlap, index) => (
                            <div
                              key={index}
                              className="border-l-4 border-red-500 pl-3 py-2 bg-red-50"
                            >
                              <p className="font-medium">{overlap.name}</p>
                              {/* COPY PASTE: Replace the existing list with this enhanced version */}
                              <div className="text-sm mt-1 space-y-1">
                                {overlap.overlappingTimes
                                  .slice(0, 3)
                                  .map((conflict, idx) => (
                                    <div key={idx} className="flex flex-col">
                                      <span className="font-medium">
                                        {conflict.time}
                                      </span>
                                      <span className="text-gray-600 ml-2">
                                        {conflict.conflictType === "user"
                                          ? `Conflicted by user: ${conflict.conflictName}`
                                          : conflict.conflictType === "workshop"
                                          ? `Conflicted by workshop: ${conflict.conflictName}`
                                          : `Conflicted by ${conflict.conflictType}: ${conflict.conflictName}`}
                                      </span>
                                    </div>
                                  ))}
                                {overlap.overlappingTimes.length > 3 && (
                                  <div className="text-gray-600">
                                    ...and {overlap.overlappingTimes.length - 3}{" "}
                                    more conflicts
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm mt-4 font-medium">
                          Workshop cannot be scheduled at times when equipment
                          is already booked. Please adjust your workshop dates
                          or select different equipment.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Go Back & Edit</AlertDialogCancel>
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
                        Some of your workshop dates are in the past. Are you
                        sure you want to save a workshop with past dates?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setFormSubmitting(false)}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          console.log(
                            "User confirmed to proceed with past dates"
                          );
                          setFormSubmitting(true);
                          setIsConfirmDialogOpen(false);
                          // FIXED: Use setTimeout to ensure dialog closes and then submit
                          setTimeout(() => {
                            const formElement = document.querySelector(
                              "form"
                            ) as HTMLFormElement;
                            if (formElement) {
                              console.log("Submitting form after confirmation");
                              // Create and dispatch a submit event to trigger the action
                              const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                              formElement.dispatchEvent(submitEvent);
                            }
                          }, 100);
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

                <div className="flex justify-center mt-6">
                  <Button
                    type="submit"
                    className="bg-yellow-500 text-white px-8 py-3 rounded-md shadow hover:bg-yellow-600 transition min-w-[200px]"
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? "Updating..." : "Update Workshop"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
