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

interface Occurrence {
  id?: number;
  startDate: Date;
  endDate: Date;
  startDatePST?: Date;
  endDatePST?: Date;
  status?: string;
  userCount?: number;
  connectId?: number | null;
}

/* ──────────────────────────────────────────────────────────────────────────────
   1) Loader: fetch the Workshop + its WorkshopOccurrences
   ---------------------------------------------------------------------------*/
export async function loader({ params }: { params: { workshopId: string } }) {
  const workshop = await getWorkshopById(Number(params.workshopId));
  const availableWorkshops = await getWorkshops();
  const availableEquipments = await getAvailableEquipment();
  const userCounts = await getWorkshopContinuationUserCount(
    Number(params.workshopId)
  );

  if (!workshop) {
    throw new Response("Workshop Not Found", { status: 404 });
  }

  return {
    workshop,
    availableWorkshops,
    availableEquipments,
    userCounts,
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

  try {
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
    });
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
        connectId: occ.connectId, // ADDED: include connectId from DB
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

  const [isWorkshopContinuation, setIsWorkshopContinuation] =
    useState<boolean>(defaultContinuation);

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

    const newOccurrence = { startDate: new Date(""), endDate: new Date("") };
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

  const handleEquipmentSelect = (id: number) => {
    const updated = selectedEquipments.includes(id)
      ? selectedEquipments.filter((e) => e !== id)
      : [...selectedEquipments, id];
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
        <form method="post">
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
                          occurrences.map((occ, index) => (
                            <OccurrenceRow
                              key={index}
                              index={index}
                              occurrence={occ}
                              updateOccurrence={updateOccurrence}
                              formatLocalDatetime={formatLocalDatetime}
                            />
                          ))
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
                                            <div className="font-medium text-green-700">
                                              {formatDateForDisplay(
                                                occ.startDate
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
                                          className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200"
                                        >
                                          <div className="text-sm">
                                            <div className="font-medium text-gray-700">
                                              {formatDateForDisplay(
                                                occ.startDate
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
                                            <div className="font-medium text-red-700">
                                              {formatDateForDisplay(
                                                occ.startDate
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

          <input
            type="hidden"
            name="occurrences"
            value={JSON.stringify(
              occurrences.map((occ) => ({
                // Keep the ID if it exists
                id: occ.id,
                startDate: occ.startDate,
                endDate: occ.endDate,
                startDatePST: occ.startDatePST,
                endDatePST: occ.endDatePST,
                status: occ.status,
                userCount: occ.userCount,
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

          <Button
            type="submit"
            className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
          >
            Update Workshop
          </Button>
        </form>
      </Form>
    </div>
  );
}
