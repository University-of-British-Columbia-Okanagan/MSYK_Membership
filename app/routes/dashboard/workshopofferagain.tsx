import React, { useState, useEffect } from "react";
import { useLoaderData, redirect, useActionData } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  workshopOfferSchema,
  type WorkshopOfferValues,
} from "../../schemas/workshopOfferAgainSchema";
import { Form, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import OccurrenceRow from "~/components/ui/Dashboard/OccurrenceRow";
import DateTypeRadioGroup from "~/components/ui/Dashboard/DateTypeRadioGroup";
import RepetitionScheduleInputs from "~/components/ui/Dashboard/RepetitionScheduleInputs";
import {
  getWorkshopById,
  offerWorkshopAgain,
  getWorkshopWithPriceVariations,
} from "~/models/workshop.server";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  CalendarDays as CalendarDaysIcon,
  CalendarRange as CalendarRangeIcon,
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
import { getUser, getRoleUser } from "~/utils/session.server";
import {
  getEquipmentSlotsWithStatus,
  getAvailableEquipment,
} from "~/models/equipment.server";
import { logger } from "~/logging/logger";
import { getEquipmentVisibilityDays } from "~/models/admin.server";
import EquipmentBookingGrid from "~/components/ui/Dashboard/EquipmentBookingGrid";
import type { SlotsByDay } from "~/components/ui/Dashboard/EquipmentBookingGrid";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/AdminSidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/GuestSidebar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─────────────────────────────────────────────────────────────────────────────
//  1) Helper: format a Date as "YYYY-MM-DDTHH:mm" for datetime-local
// ─────────────────────────────────────────────────────────────────────────────
function formatLocalDatetime(dateInput: Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2) Helper: parse a "YYYY-MM-DDTHH:mm" string into a local Date
// ─────────────────────────────────────────────────────────────────────────────
function parseDateTimeAsLocal(value: string): Date {
  if (!value) return new Date(""); // invalid date
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
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

/**
 * Get equipment slots for workshop occurrences
 */
function getEquipmentSlotsForOccurrences(
  occurrences: { startDate: Date; endDate: Date }[]
): {
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

// ─────────────────────────────────────────────────────────────────────────────
//  3) Loader
// ─────────────────────────────────────────────────────────────────────────────
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const workshopId = Number(params.id);
  const roleUser = await getRoleUser(request);

  // Get workshop details including existing occurrences
  const workshop = await getWorkshopWithPriceVariations(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  const user = await getUser(request);
  const userId = user?.id || undefined;

  // Get equipment slots and available equipment
  const equipmentsWithSlots = await getEquipmentSlotsWithStatus(userId, true);
  const availableEquipments = await getAvailableEquipment();
  const equipmentVisibilityDays = await getEquipmentVisibilityDays();

  return {
    workshopId,
    workshop,
    roleUser,
    equipmentsWithSlots,
    availableEquipments,
    equipmentVisibilityDays,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  4) Action
// ─────────────────────────────────────────────────────────────────────────────
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 419 });
  }

  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries()) as Record<
    string,
    string
  >;

  // Parse occurrences from JSON string
  let occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST: Date;
    endDatePST: Date;
  }[] = [];

  try {
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: {
        startDate: string;
        endDate: string;
        startDatePST: string;
        endDatePST: string;
      }) => {
        const localStart = new Date(occ.startDate);
        const localEnd = new Date(occ.endDate);
        const startDatePST = new Date(occ.startDatePST);
        const endDatePST = new Date(occ.endDatePST);

        // Validation: Ensure end date is later than start date
        if (localEnd.getTime() <= localStart.getTime()) {
          throw new Error("End date must be later than start date");
        }

        return {
          startDate: localStart,
          endDate: localEnd,
          startDatePST,
          endDatePST,
        };
      }
    );
  } catch (error) {
    logger.error(`Error parsing occurrences: ${error}`, { url: request.url });
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

  // Validate with zod schema
  const parsed = workshopOfferSchema.safeParse({
    occurrences: occurrences.map((occ) => ({
      startDate: occ.startDate,
      endDate: occ.endDate,
      startDatePST: occ.startDatePST,
      endDatePST: occ.endDatePST,
    })),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const workshopId = Number(params.id);

  // Get existing workshop occurrences to check for duplicates
  const existingWorkshop = await getWorkshopWithPriceVariations(workshopId);
  if (!existingWorkshop) {
    return { errors: { general: ["Workshop not found"] } };
  }

  // Check for duplicate times in future active occurrences
  const now = new Date();
  const futureActiveOccurrences = existingWorkshop.occurrences.filter(
    (occ: any) => new Date(occ.startDate) >= now && occ.status === "active"
  );

  for (const newOcc of occurrences) {
    for (const existingOcc of futureActiveOccurrences) {
      const existingStart = new Date(existingOcc.startDate);
      const existingEnd = new Date(existingOcc.endDate);

      // Check if new occurrence overlaps with existing ones
      if (
        (newOcc.startDate >= existingStart && newOcc.startDate < existingEnd) ||
        (newOcc.endDate > existingStart && newOcc.endDate <= existingEnd) ||
        (newOcc.startDate <= existingStart && newOcc.endDate >= existingEnd)
      ) {
        const formatDate = (date: Date) => {
          return (
            date.toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            }) +
            ", " +
            date.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          );
        };

        return {
          errors: {
            occurrences: [
              `Cannot create workshop time ${formatDate(newOcc.startDate)} to ${formatDate(newOcc.endDate)} because it overlaps with existing workshop time ${formatDate(existingStart)} to ${formatDate(existingEnd)}.`,
            ],
          },
        };
      }
    }
  }

  // CHECK FOR EQUIPMENT CONFLICTS
  if (existingWorkshop.equipments && existingWorkshop.equipments.length > 0) {
    // Get equipment slots for validation
    const equipmentsWithSlots = await getEquipmentSlotsWithStatus(
      undefined,
      true
    );

    // Check each new occurrence against equipment bookings
    for (const newOcc of occurrences) {
      for (const equipmentId of existingWorkshop.equipments) {
        const equipment = equipmentsWithSlots.find(
          (eq: any) => eq.id === equipmentId
        );
        if (!equipment) continue;

        // Create 30-minute slots for the new occurrence
        const currentTime = new Date(newOcc.startDate);
        while (currentTime < newOcc.endDate) {
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

          // Check if this slot exists and is booked
          const slot = equipment.slotsByDay[dayKey]?.[timeKey];
          if (slot && (slot.isBooked || slot.reservedForWorkshop)) {
            // Skip if it's reserved for this same workshop
            if ((slot as any).workshopName === existingWorkshop.name) {
              currentTime.setTime(currentTime.getTime() + 30 * 60 * 1000);
              continue;
            }

            // Calculate end time for display
            const endTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
            const endHours = String(endTime.getHours()).padStart(2, "0");
            const endMinutes = String(endTime.getMinutes()).padStart(2, "0");

            const formatDate = (date: Date) => {
              return (
                date.toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }) +
                ", " +
                date.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              );
            };

            // Determine conflict type and name
            let conflictName = "Unknown booking";
            if (slot.reservedForWorkshop && (slot as any).workshopName) {
              conflictName = `workshop "${(slot as any).workshopName}"`;
            } else if (
              slot.isBooked &&
              (slot as any).userFirstName &&
              (slot as any).userLastName
            ) {
              conflictName = `user ${(slot as any).userFirstName} ${(slot as any).userLastName}`;
            } else if (slot.reservedForWorkshop) {
              conflictName = "another workshop";
            } else if (slot.isBooked) {
              conflictName = "another user";
            }

            return {
              errors: {
                occurrences: [
                  `Equipment "${equipment.name}" is already booked on ${formatDate(currentTime)} from ${hours}:${minutes} to ${endHours}:${endMinutes} by ${conflictName}. Please choose different dates or times.`,
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

  // Add new occurrences with the same workshop ID but a new offerId
  await offerWorkshopAgain(workshopId, occurrences);

  return redirect(`/dashboard/workshops/`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  5) WorkshopOfferAgain Component
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkshopOfferAgain() {
  const {
    workshopId,
    workshop,
    roleUser,
    equipmentsWithSlots,
    availableEquipments,
    equipmentVisibilityDays,
  } = useLoaderData() as {
    workshopId: number;
    workshop: any;
    roleUser: any;
    equipmentsWithSlots: any[];
    availableEquipments: any[];
    equipmentVisibilityDays: number;
  };
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const navigate = useNavigate();

  const selectedEquipments: number[] = workshop.equipments || [];

  // Store original workshop dates for reference
  const [originalOccurrences, setOriginalOccurrences] = useState<
    { startDate: Date; endDate: Date; startDatePST?: Date; endDatePST?: Date }[]
  >(() => {
    // Pre-populate with the workshop's existing occurrences
    if (workshop.occurrences && workshop.occurrences.length > 0) {
      // First, find the latest offerId
      let latestOfferId = 0;
      workshop.occurrences.forEach((occ: any) => {
        if (occ.offerId && occ.offerId > latestOfferId) {
          latestOfferId = occ.offerId;
        }
      });

      // Filter for occurrences with the latest offerId only
      return (
        workshop.occurrences
          // .filter((occ: any) => occ.offerId === latestOfferId)
          .map((occ: any) => ({
            startDate: new Date(occ.startDate),
            endDate: new Date(occ.endDate),
            startDatePST: occ.startDatePST
              ? new Date(occ.startDatePST)
              : undefined,
            endDatePST: occ.endDatePST ? new Date(occ.endDatePST) : undefined,
          }))
          .filter(
            (occ: any) =>
              !isNaN(occ.startDate.getTime()) && !isNaN(occ.endDate.getTime())
          )
          .sort(
            (a: { startDate: Date }, b: { startDate: Date }) =>
              a.startDate.getTime() - b.startDate.getTime()
          )
      ); // Sort by start date ascending
    }
    return [];
  });

  // State for occurrences - initialize as empty
  const [occurrences, setOccurrences] = useState<
    { startDate: Date; endDate: Date; startDatePST?: Date; endDatePST?: Date }[]
  >([]);

  // Date selection type state
  const [dateSelectionType, setDateSelectionType] = useState<
    "custom" | "weekly" | "monthly"
  >("custom");

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

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const form = useForm<WorkshopOfferValues>({
    resolver: zodResolver(workshopOfferSchema),
    defaultValues: {
      occurrences: [],
    },
  });

  // Update form with occurrences when they change
  useEffect(() => {
    if (occurrences.length > 0) {
      form.setValue("occurrences", occurrences);
    }
  }, [occurrences, form, form.setValue]);

  // For custom dates, add an empty occurrence
  const addOccurrence = () => {
    const newOccurrence = {
      startDate: new Date(""),
      endDate: new Date(""),
    };
    const updatedOccurrences = [...occurrences, newOccurrence];
    // Sort by startDate (if dates are valid)
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );
    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  };

  // Update an occurrence when its datetime input changes
  function updateOccurrence(
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) {
    const localDate = parseDateTimeAsLocal(value);
    const updatedOccurrences = [...occurrences];
    updatedOccurrences[index][field] = localDate;

    // If updating start date and it's valid, automatically set end date to 2 hours later
    if (field === "startDate" && !isNaN(localDate.getTime())) {
      const endDate = new Date(localDate.getTime() + 2 * 60 * 60 * 1000); // Add 2 hours
      updatedOccurrences[index].endDate = endDate;

      // Calculate PST dates for both start and end when updating start date
      const startOffset = localDate.getTimezoneOffset();
      updatedOccurrences[index].startDatePST = new Date(
        localDate.getTime() - startOffset * 60000
      );

      const endOffset = endDate.getTimezoneOffset();
      updatedOccurrences[index].endDatePST = new Date(
        endDate.getTime() - endOffset * 60000
      );
    } else if (field === "endDate" && !isNaN(localDate.getTime())) {
      // Calculate PST date when updating end date only
      const endOffset = localDate.getTimezoneOffset();
      updatedOccurrences[index].endDatePST = new Date(
        localDate.getTime() - endOffset * 60000
      );
    }

    // Re-sort the list after updating
    updatedOccurrences.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );
    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  }

  // Remove an occurrence
  const removeOccurrence = (index: number) => {
    const updated = occurrences.filter((_, i) => i !== index);
    setOccurrences(updated);
    form.setValue("occurrences", updated);
  };

  // Check for duplicate dates
  const isDuplicateDate = (newDate: Date, existingDates: Date[]) => {
    // Check against existing future active occurrences
    const now = new Date();
    const futureActiveOccurrences =
      workshop.occurrences?.filter(
        (occ: any) => new Date(occ.startDate) >= now && occ.status === "active"
      ) || [];

    // Check if the new date conflicts with any existing occurrences
    for (const existingOcc of futureActiveOccurrences) {
      const existingStart = new Date(existingOcc.startDate);
      const existingEnd = new Date(existingOcc.endDate);

      // For the RepetitionScheduleInputs, we're typically checking start dates
      // So we check if the newDate falls within any existing workshop time range
      if (newDate >= existingStart && newDate < existingEnd) {
        return true;
      }
    }

    // Also check against the existingDates parameter (dates already added in the current session)
    for (const existingDate of existingDates) {
      // Check if dates are the same day and similar time (within 30 minutes)
      const timeDiff = Math.abs(newDate.getTime() - existingDate.getTime());
      if (timeDiff < 30 * 60 * 1000) {
        // 30 minutes in milliseconds
        return true;
      }
    }

    return false;
  };

  // Format date for display
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

  // Form submission handler with past date check
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // First check if any dates are in the past
    if (hasOccurrencesInPast(occurrences)) {
      setIsConfirmDialogOpen(true);
      return; // Prevent the normal form submission flow
    } else {
      // No past dates, submit directly
      setFormSubmitting(true);
      const form = e.currentTarget as HTMLFormElement;
      form.submit();
    }
  };

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {!roleUser ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-8">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    isAdmin ? "/dashboard/workshops" : "/dashboard/workshops"
                  )
                }
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Workshops
              </Button>
            </div>
            <h1 className="text-2xl font-bold mb-8 text-center">
              Create New Offering: {workshop.name}
            </h1>

            {actionData?.errors &&
              Object.keys(actionData.errors).length > 0 && (
                <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
                  There are some errors in your form. Please review the
                  highlighted fields below.
                </div>
              )}

            <div className="mb-8 bg-yellow-50 p-4 border border-yellow-200 rounded-md">
              <h2 className="text-lg font-semibold mb-2">
                Offering Workshop Again
              </h2>
              <p className="text-sm text-gray-700 mb-2">
                You can view the current workshop dates below as a reference.
                Add new dates for this workshop offering.
              </p>
              <p className="text-sm text-gray-700">
                When you submit this form, a new set of workshop occurrences
                will be created with the dates you add.
              </p>
            </div>

            <Form {...form}>
              <form
                method="post"
                className="space-y-6"
                onSubmit={handleFormSubmit}
              >
                {/* Workshop Dates Section */}

                {/* Display Reference Occurrences if they exist */}
                {originalOccurrences.length > 0 && (
                  <div className="w-full mb-6">
                    <h3 className="font-medium mb-4 flex items-center">
                      <CalendarIcon className="w-5 h-5 mr-2 text-gray-500" />
                      Most Recent Workshop Dates (Reference)
                    </h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      {originalOccurrences.map((occ, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 border-b last:border-b-0"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-700">
                              {formatDisplayDate(occ.startDate)}
                            </div>
                            <div className="text-sm text-gray-600">
                              to {formatDisplayDate(occ.endDate)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

                  <div className="flex flex-col items-start space-y-6 w-full">
                    {/* Radio Buttons for selecting date input type */}
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

                    {/* Custom Dates Input */}
                    {dateSelectionType === "custom" && (
                      <div className="flex flex-col items-center w-full p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        {occurrences.length === 0 ? (
                          <div className="text-center py-6 text-gray-500">
                            <p className="text-sm">
                              No new dates added yet. Please use the button
                              below to add workshop dates for the new offering.
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
                                      className={`w-full ${
                                        hasWarning
                                          ? "border-l-4 border-amber-500 pl-2"
                                          : ""
                                      }`}
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

                    {/* Weekly Dates Input */}
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
                          updateFormOccurrences={(updatedOccurrences) => {
                            form.setValue("occurrences", updatedOccurrences);
                          }}
                          parseDateTimeAsLocal={parseDateTimeAsLocal}
                          isDuplicateDate={isDuplicateDate}
                          onRevert={() => setDateSelectionType("weekly")}
                        />
                      </div>
                    )}

                    {/* Monthly Dates Input */}
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
                            form.setValue("occurrences", updatedOccurrences);
                          }}
                          parseDateTimeAsLocal={parseDateTimeAsLocal}
                          isDuplicateDate={isDuplicateDate}
                          onRevert={() => setDateSelectionType("monthly")}
                        />
                      </div>
                    )}

                    {/* Display of added occurrences */}
                    {occurrences.length > 0 && (
                      <div className="w-full">
                        <h3 className="font-medium mb-4 flex items-center">
                          <CalendarIcon className="w-5 h-5 mr-2 text-yellow-500" />
                          Your New Workshop Dates
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {occurrences.map((occ, index) => {
                            const isStartDatePast = isDateInPast(occ.startDate);
                            const isEndDatePast = isDateInPast(occ.endDate);
                            const hasWarning = isStartDatePast || isEndDatePast;

                            return (
                              <div
                                key={index}
                                className={`flex justify-between items-center p-3 bg-white border-b last:border-b-0 hover:bg-gray-50 transition-colors duration-150 ${
                                  hasWarning
                                    ? "border-l-4 border-amber-500"
                                    : ""
                                }`}
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => removeOccurrence(index)}
                                  className="text-sm text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-300 py-1 px-3 rounded"
                                >
                                  Remove
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <FormMessage>{actionData?.errors?.occurrences}</FormMessage>
                </FormItem>

                {/* EQUIPMENT USAGE TABS */}
                {workshop.equipments && workshop.equipments.length > 0 && (
                  <div className="mt-8 mb-6">
                    <h3 className="font-semibold mb-4 text-lg">
                      Workshop Equipment Usage
                    </h3>
                    <div className="mb-4 text-sm text-center text-blue-600 bg-blue-100 p-3 rounded border border-blue-300">
                      <p>
                        This workshop uses the following equipment. Ensure your
                        new dates don't conflict with existing bookings.
                      </p>
                    </div>

                    {(() => {
                      // DEDUPLICATE EQUIPMENT IDS
                      const uniqueEquipmentIds = [
                        ...new Set(selectedEquipments),
                      ];

                      return (
                        <Tabs
                          defaultValue={uniqueEquipmentIds[0]?.toString() || ""}
                          className="w-full"
                        >
                          <TabsList className="mb-4">
                            {uniqueEquipmentIds.map((equipmentId: number) => {
                              const equipment = equipmentsWithSlots.find(
                                (eq) => eq.id === equipmentId
                              );
                              return (
                                <TabsTrigger
                                  key={`eq-tab-${equipmentId}`}
                                  value={equipmentId.toString()}
                                  className="px-4 py-2"
                                >
                                  {equipment?.name ||
                                    `Equipment ${equipmentId}`}
                                </TabsTrigger>
                              );
                            })}
                          </TabsList>

                          {uniqueEquipmentIds.map((equipmentId: number) => {
                            const equipment = equipmentsWithSlots.find(
                              (eq) => eq.id === equipmentId
                            );
                            if (!equipment) return null;

                            // Create a condensed time range summary
                            const getTimeRangeSummary = () => {
                              if (originalOccurrences.length === 0)
                                return "No scheduled times";

                              if (originalOccurrences.length === 1) {
                                const occ = originalOccurrences[0];
                                return `${occ.startDate.toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )} ${occ.startDate.toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })} - ${occ.endDate.toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  }
                                )}`;
                              }

                              // Multiple occurrences - show range
                              const sortedOccs = [...originalOccurrences].sort(
                                (a, b) =>
                                  a.startDate.getTime() - b.startDate.getTime()
                              );
                              const firstOcc = sortedOccs[0];
                              const lastOcc = sortedOccs[sortedOccs.length - 1];

                              return `${sortedOccs.length} sessions: ${firstOcc.startDate.toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )} - ${lastOcc.endDate.toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )}`;
                            };

                            return (
                              <TabsContent
                                key={`eq-content-${equipmentId}`}
                                value={equipmentId.toString()}
                                className="mt-0 p-0"
                              >
                                <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-lg">
                                      {equipment.name}
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700"
                                    >
                                      {originalOccurrences.length} session
                                      {originalOccurrences.length !== 1
                                        ? "s"
                                        : ""}
                                    </Badge>
                                  </div>

                                  <div className="text-sm text-gray-600 mb-3">
                                    <strong>Usage Times:</strong>{" "}
                                    {getTimeRangeSummary()}
                                  </div>

                                  {originalOccurrences.length > 1 && (
                                    <details className="group">
                                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center">
                                        <span>View all session times</span>
                                        <svg
                                          className="w-4 h-4 ml-1 transition-transform group-open:rotate-180"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </summary>
                                      <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
                                        {originalOccurrences.map(
                                          (occ, index) => (
                                            <div
                                              key={index}
                                              className="text-sm"
                                            >
                                              <div className="font-medium text-gray-700">
                                                {occ.startDate.toLocaleDateString(
                                                  "en-US",
                                                  {
                                                    weekday: "short",
                                                    month: "short",
                                                    day: "numeric",
                                                  }
                                                )}{" "}
                                                {occ.startDate.toLocaleTimeString(
                                                  "en-US",
                                                  {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                    hour12: true,
                                                  }
                                                )}
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                to{" "}
                                                {occ.endDate.toLocaleTimeString(
                                                  "en-US",
                                                  {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                    hour12: true,
                                                  }
                                                )}
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              </TabsContent>
                            );
                          })}
                        </Tabs>
                      );
                    })()}
                  </div>
                )}

                {/* Hidden input for occurrences */}

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
                      .map((occ) => {
                        // Calculate PST dates for any entries missing them
                        const startOffset = occ.startDate.getTimezoneOffset();
                        const startDatePST =
                          occ.startDatePST ||
                          new Date(
                            occ.startDate.getTime() - startOffset * 60000
                          );

                        const endOffset = occ.endDate.getTimezoneOffset();
                        const endDatePST =
                          occ.endDatePST ||
                          new Date(occ.endDate.getTime() - endOffset * 60000);

                        return {
                          startDate: occ.startDate.toISOString(),
                          endDate: occ.endDate.toISOString(),
                          startDatePST: startDatePST.toISOString(),
                          endDatePST: endDatePST.toISOString(),
                        };
                      })
                  )}
                />

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
                        sure you want to create a new offering with past dates?
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

                {/* Submit Button */}
                <div className="flex justify-center">
                  <Button
                    type="submit"
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                    disabled={occurrences.length === 0 || formSubmitting}
                  >
                    Create New Offering
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
