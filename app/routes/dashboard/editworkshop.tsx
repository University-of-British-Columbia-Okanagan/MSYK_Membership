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
} from "~/models/workshop.server";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import GenericFormField from "~/components/ui/GenericFormField";
import DateTypeRadioGroup from "@/components/ui/DateTypeRadioGroup";

interface Occurrence {
  id?: number;
  startDate: Date;
  endDate: Date;
  startDatePST?: Date;
  endDatePST?: Date;
  status?: string;
  userCount?: number;
}

/* ──────────────────────────────────────────────────────────────────────────────
   1) Loader: fetch the Workshop + its WorkshopOccurrences
   ---------------------------------------------------------------------------*/
export async function loader({ params }: { params: { workshopId: string } }) {
  const workshop = await getWorkshopById(Number(params.workshopId));
  const availableWorkshops = await getWorkshops();

  if (!workshop) {
    throw new Response("Workshop Not Found", { status: 404 });
  }

  return {
    workshop,
    availableWorkshops,
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
    try {
      await cancelWorkshopOccurrence(occurrenceId);
    } catch (error) {
      console.error("Error cancelling occurrence:", error);
      return { errors: { cancel: ["Failed to cancel occurrence"] } };
    }
    return redirect("/admindashboardlayout");
  }

  // Convert price & capacity
  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);
  const prerequisites = JSON.parse(rawValues.prerequisites as string).map(
    Number
  );

  // Declare occurrences with an explicit type
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
    // Parse the JSON string from rawValues and process each occurrence
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: {
        id?: number;
        status?: string;
        userCount?: number;
        startDate: string;
        endDate: string;
        startDatePST?: string;
        endDatePST?: string;
      }) => {
        // If either date is an empty string, throw an error.
        if (!occ.startDate || !occ.endDate) {
          throw new Error("Occurrence dates cannot be empty");
        }
        const localStart = new Date(occ.startDate);
        const localEnd = new Date(occ.endDate);

        if (isNaN(localStart.getTime()) || isNaN(localEnd.getTime())) {
          throw new Error("Invalid date format");
        }

        // Calculate PST (or UTC-shifted) times
        const startOffset = localStart.getTimezoneOffset();
        const utcStart = new Date(localStart.getTime() - startOffset * 60000);
        const endOffset = localEnd.getTimezoneOffset();
        const utcEnd = new Date(localEnd.getTime() - endOffset * 60000);

        return {
          id: occ.id, // preserve if provided
          status: occ.status, // preserve if provided
          userCount: occ.userCount, // preserve if provided
          startDate: localStart,
          endDate: localEnd,
          // If PST dates were sent, parse them; otherwise, use computed UTC values
          startDatePST: occ.startDatePST
            ? new Date(occ.startDatePST)
            : utcStart,
          endDatePST: occ.endDatePST ? new Date(occ.endDatePST) : utcEnd,
        };
      }
    );
  } catch (error) {
    console.error("Error parsing occurrences:", error);
    return { errors: { occurrences: ["Invalid date format"] } };
  }

  const parsed = workshopFormSchema.safeParse({
    ...rawValues,
    price,
    capacity,
    occurrences,
    prerequisites,
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

function getWorkshopPrerequsities(
  availableWorkshops: { id: number; name: string }[],
  selectedPrerequisites: number[],
  handlePrerequisiteSelect: (workshopId: number) => void,
  removePrerequisite: (workshopId: number) => void,
  currentWorkshopId: number
) {
  const sortedSelected = [...selectedPrerequisites].sort((a, b) => a - b);
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {sortedSelected.map((prereqId) => {
          const workshop = availableWorkshops.find((w) => w.id === prereqId);
          return workshop ? (
            <Badge key={prereqId} variant="secondary" className="py-1 px-2">
              {workshop.name}
              <button
                type="button"
                onClick={() => removePrerequisite(prereqId)}
                className="ml-2 text-xs"
              >
                ×
              </button>
            </Badge>
          ) : null;
        })}
      </div>
      <Select
        onValueChange={(value) => handlePrerequisiteSelect(Number(value))}
        value=""
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select prerequisites..." />
        </SelectTrigger>
        <SelectContent>
          {availableWorkshops
            // Filter out the current workshop as well as already selected prerequisites.
            .filter(
              (w) =>
                w.id !== currentWorkshopId &&
                !selectedPrerequisites.includes(w.id)
            )
            .sort((a, b) => a.id - b.id)
            .map((w) => (
              <SelectItem key={w.id} value={w.id.toString()}>
                {w.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <div className="text-xs text-gray-500 mt-1">
        Select workshops that must be completed before enrolling in this one
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   5) The EditWorkshop component
   ---------------------------------------------------------------------------*/
export default function EditWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  // const workshop = useLoaderData<typeof loader>();
  const { workshop, availableWorkshops } =
    useLoaderData<Awaited<ReturnType<typeof loader>>>();

  // Convert DB's existing occurrences (UTC) to local Date objects (NOT DOING THIS ANYMORE)
  const initialOccurrences =
    workshop.occurrences?.map((occ: any) => {
      const localStart = new Date(occ.startDate);
      const localEnd = new Date(occ.endDate);
      // We interpret them in UTC (NOT DOING THIS ANYMORE), so to show local we just use them directly as Date
      return {
        id: occ.id,
        startDate: localStart,
        endDate: localEnd,
        status: occ.status,
        userCount: occ.userWorkshops?.length ?? 0,
      }; // EDITED TO SHOW LOCAL START, LOCAL END
    }) || [];

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
  const addOccurrence = () => {
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

          {/* Occurrences (Dates) with Tabs */}
          <FormField
            control={form.control}
            name="occurrences"
            render={() => (
              <FormItem className="mt-6">
                <FormLabel>
                  Edit Workshop Dates <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <div className="flex flex-col items-start space-y-4 w-full">
                    {/* Radio Buttons for date selection type */}
                    <DateTypeRadioGroup
                      options={[
                        { value: "custom", label: "Manage dates" },
                        { value: "weekly", label: "Append weekly dates" },
                        { value: "monthly", label: "Append monthly dates" },
                      ]}
                      selectedValue={dateSelectionType}
                      onChange={(val) =>
                        setDateSelectionType(
                          val as "custom" | "weekly" | "monthly"
                        )
                      }
                      name="dateType"
                    />

                    {/* Custom Dates */}
                    {dateSelectionType === "custom" && (
                      <div className="flex flex-col items-center w-full">
                        {occurrences.map((occ, index) => (
                          <div
                            key={index}
                            className="flex gap-2 items-center mb-2 w-full"
                          >
                            <Input
                              type="datetime-local"
                              value={
                                isNaN(occ.startDate.getTime())
                                  ? ""
                                  : formatLocalDatetime(occ.startDate)
                              }
                              onChange={(e) =>
                                updateOccurrence(
                                  index,
                                  "startDate",
                                  e.target.value
                                )
                              }
                              className="flex-1"
                            />
                            <Input
                              type="datetime-local"
                              value={
                                isNaN(occ.endDate.getTime())
                                  ? ""
                                  : formatLocalDatetime(occ.endDate)
                              }
                              onChange={(e) =>
                                updateOccurrence(
                                  index,
                                  "endDate",
                                  e.target.value
                                )
                              }
                              className="flex-1"
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          onClick={addOccurrence}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                        >
                          + Add Date
                        </Button>
                      </div>
                    )}

                    {/* Weekly Repetition */}
                    {dateSelectionType === "weekly" && (
                      <div className="flex flex-col items-start w-full space-y-4">
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <div className="flex flex-col space-y-2">
                            <FormLabel>First Occurrence Start</FormLabel>
                            <Input
                              type="datetime-local"
                              value={weeklyStartDate}
                              onChange={(e) =>
                                setWeeklyStartDate(e.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <FormLabel>First Occurrence End</FormLabel>
                            <Input
                              type="datetime-local"
                              value={weeklyEndDate}
                              onChange={(e) => setWeeklyEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <div className="flex flex-col space-y-2">
                            <FormLabel>Repeat every (weeks)</FormLabel>
                            <Input
                              type="number"
                              min="1"
                              value={weeklyInterval}
                              onChange={(e) =>
                                setWeeklyInterval(Number(e.target.value))
                              }
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <FormLabel>Number of repetitions</FormLabel>
                            <Input
                              type="number"
                              min="1"
                              value={weeklyCount}
                              onChange={(e) =>
                                setWeeklyCount(Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!weeklyStartDate || !weeklyEndDate) {
                              alert("Please select initial start/end dates");
                              return;
                            }
                            if (weeklyInterval < 1 || weeklyCount < 1) {
                              alert("Invalid interval or repetition");
                              return;
                            }
                            const newOccurrences: {
                              startDate: Date;
                              endDate: Date;
                              status?: string;
                              userCount?: number;
                            }[] = [];
                            const start = parseDateTimeAsLocal(weeklyStartDate);
                            const end = parseDateTimeAsLocal(weeklyEndDate);
                            const baseOccurrence = {
                              startDate: new Date(start),
                              endDate: new Date(end),
                            };

                            // Generate new occurrences
                            for (let i = 0; i < weeklyCount; i++) {
                              const occurrence = {
                                startDate: new Date(baseOccurrence.startDate),
                                endDate: new Date(baseOccurrence.endDate),
                              };
                              occurrence.startDate.setDate(
                                baseOccurrence.startDate.getDate() +
                                  weeklyInterval * 7 * i
                              );
                              occurrence.endDate.setDate(
                                baseOccurrence.endDate.getDate() +
                                  weeklyInterval * 7 * i
                              );

                              // Check if this date already exists in the current occurrences
                              const existingStartDates = occurrences.map(
                                (o) => o.startDate
                              );
                              if (
                                !isDuplicateDate(
                                  occurrence.startDate,
                                  existingStartDates
                                )
                              ) {
                                const computedStatus =
                                  occurrence.startDate >= new Date()
                                    ? "active"
                                    : "past";
                                newOccurrences.push({
                                  ...occurrence,
                                  status: computedStatus,
                                  userCount: 0,
                                });
                              }
                            }

                            // Append new occurrences to existing ones instead of replacing
                            const updatedOccurrences = [
                              ...occurrences,
                              ...newOccurrences,
                            ];

                            updatedOccurrences.sort(
                              (a, b) =>
                                a.startDate.getTime() - b.startDate.getTime()
                            );
                            setOccurrences(updatedOccurrences);
                            form.setValue("occurrences", updatedOccurrences);

                            setDateSelectionType("custom");
                          }}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                        >
                          Append Weekly Dates
                        </Button>
                      </div>
                    )}

                    {/* Monthly Repetition */}
                    {dateSelectionType === "monthly" && (
                      <>
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <div className="flex flex-col space-y-2">
                            <FormLabel>First Occurrence Start</FormLabel>
                            <Input
                              type="datetime-local"
                              value={monthlyStartDate}
                              onChange={(e) =>
                                setMonthlyStartDate(e.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <FormLabel>First Occurrence End</FormLabel>
                            <Input
                              type="datetime-local"
                              value={monthlyEndDate}
                              onChange={(e) =>
                                setMonthlyEndDate(e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <div className="flex flex-col space-y-2">
                            <FormLabel>Repeat every (months)</FormLabel>
                            <Input
                              type="number"
                              min="1"
                              value={monthlyInterval}
                              onChange={(e) =>
                                setMonthlyInterval(Number(e.target.value))
                              }
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <FormLabel>Number of repetitions</FormLabel>
                            <Input
                              type="number"
                              min="1"
                              value={monthlyCount}
                              onChange={(e) =>
                                setMonthlyCount(Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!monthlyStartDate || !monthlyEndDate) {
                              alert(
                                "Please select initial start and end dates"
                              );
                              return;
                            }
                            if (monthlyInterval < 1 || monthlyCount < 1) {
                              alert("Invalid interval or repetition");
                              return;
                            }
                            const newOccurrences: {
                              startDate: Date;
                              endDate: Date;
                              status?: string;
                              userCount?: number;
                            }[] = [];
                            const start =
                              parseDateTimeAsLocal(monthlyStartDate);
                            const end = parseDateTimeAsLocal(monthlyEndDate);
                            const baseOccurrence = {
                              startDate: new Date(start),
                              endDate: new Date(end),
                            };

                            // Generate new occurrences
                            for (let i = 0; i < monthlyCount; i++) {
                              const occurrence = {
                                startDate: new Date(baseOccurrence.startDate),
                                endDate: new Date(baseOccurrence.endDate),
                              };
                              occurrence.startDate.setMonth(
                                baseOccurrence.startDate.getMonth() +
                                  monthlyInterval * i
                              );
                              occurrence.endDate.setMonth(
                                baseOccurrence.endDate.getMonth() +
                                  monthlyInterval * i
                              );

                              // Check if this date already exists in the current occurrences
                              const existingStartDates = occurrences.map(
                                (o) => o.startDate
                              );
                              if (
                                !isDuplicateDate(
                                  occurrence.startDate,
                                  existingStartDates
                                )
                              ) {
                                const computedStatus =
                                  occurrence.startDate >= new Date()
                                    ? "active"
                                    : "past";
                                newOccurrences.push({
                                  ...occurrence,
                                  status: computedStatus,
                                  userCount: 0,
                                });
                              }
                            }

                            // Append new occurrences to existing ones instead of replacing
                            const updatedOccurrences = [
                              ...occurrences,
                              ...newOccurrences,
                            ];

                            updatedOccurrences.sort(
                              (a, b) =>
                                a.startDate.getTime() - b.startDate.getTime()
                            );
                            setOccurrences(updatedOccurrences);
                            form.setValue("occurrences", updatedOccurrences);

                            setDateSelectionType("custom");
                          }}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                        >
                          Append Monthly Dates
                        </Button>
                      </>
                    )}

                    {/* If we have generated occurrences, display them in Tabs */}
                    {occurrences.length > 0 && (
                      <div className="w-full mt-4">
                        <h3 className="font-medium mb-4">Workshop Dates:</h3>

                        <Tabs defaultValue="active" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger
                              value="active"
                              className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white"
                            >
                              Active ({activeOccurrences.length})
                            </TabsTrigger>
                            <TabsTrigger
                              value="past"
                              className="data-[state=active]:bg-gray-500 data-[state=active]:text-white"
                            >
                              Past ({pastOccurrences.length})
                            </TabsTrigger>
                            <TabsTrigger
                              value="cancelled"
                              className="data-[state=active]:bg-red-500 data-[state=active]:text-white"
                            >
                              Cancelled ({cancelledOccurrences.length})
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent
                            value="active"
                            className="border rounded-md p-4 mt-2"
                          >
                            {activeOccurrences.length > 0 ? (
                              <div className="space-y-3">
                                {activeOccurrences.map((occ, index) => {
                                  // Find the original index in the complete occurrences array
                                  const originalIndex = occurrences.findIndex(
                                    (o) =>
                                      o.startDate.getTime() ===
                                        occ.startDate.getTime() &&
                                      o.endDate.getTime() ===
                                        occ.endDate.getTime()
                                  );
                                  const hasUsers =
                                    occ.userCount && occ.userCount > 0;
                                  return (
                                    <div
                                      key={index}
                                      className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-md"
                                    >
                                      <div className="text-sm">
                                        <div className="font-medium text-green-700">
                                          {formatDateForDisplay(occ.startDate)}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          to {formatDateForDisplay(occ.endDate)}
                                        </div>
                                      </div>
                                      <div className="flex items-center">
                                        <span className="mr-2 text-sm font-bold text-gray-800">
                                          {occ.userCount ?? 0} users registered
                                        </span>
                                        {hasUsers ? (
                                          <ConfirmButton
                                            confirmTitle="Cancel Occurrence"
                                            confirmDescription="Are you sure you want to cancel this occurrence? This action cannot be undone."
                                            onConfirm={() =>
                                              handleCancelOccurrence(occ.id)
                                            }
                                            buttonLabel="Cancel"
                                            buttonClassName="bg-blue-500 hover:bg-blue-600 text-white h-8 px-3 rounded-full"
                                          />
                                        ) : (
                                          <ConfirmButton
                                            confirmTitle="Delete Occurrence"
                                            confirmDescription="Are you sure you want to delete this occurrence?"
                                            onConfirm={() =>
                                              removeOccurrence(originalIndex)
                                            }
                                            buttonLabel="X"
                                            buttonClassName="bg-red-500 hover:bg-red-600 text-white h-8 px-3 rounded-full"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                No active workshop dates scheduled
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent
                            value="past"
                            className="border rounded-md p-4 mt-2"
                          >
                            {pastOccurrences.length > 0 ? (
                              <div className="space-y-3">
                                {pastOccurrences.map((occ, index) => {
                                  const originalIndex = occurrences.findIndex(
                                    (o) =>
                                      o.startDate.getTime() ===
                                        occ.startDate.getTime() &&
                                      o.endDate.getTime() ===
                                        occ.endDate.getTime()
                                  );
                                  return (
                                    <div
                                      key={index}
                                      className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-md"
                                    >
                                      <div className="text-sm">
                                        <div className="font-medium text-gray-700">
                                          {formatDateForDisplay(occ.startDate)}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          to {formatDateForDisplay(occ.endDate)}
                                        </div>
                                      </div>
                                      <div className="flex items-center">
                                        <span className="mr-2 text-sm font-bold text-gray-800">
                                          {occ.userCount ?? 0} users registered
                                        </span>

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
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                No past workshop dates
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent
                            value="cancelled"
                            className="border rounded-md p-4 mt-2"
                          >
                            {cancelledOccurrences.length > 0 ? (
                              <div className="space-y-3">
                                {cancelledOccurrences.map((occ, index) => {
                                  const originalIndex = occurrences.findIndex(
                                    (o) =>
                                      o.startDate.getTime() ===
                                        occ.startDate.getTime() &&
                                      o.endDate.getTime() ===
                                        occ.endDate.getTime()
                                  );
                                  return (
                                    <div
                                      key={index}
                                      className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-md"
                                    >
                                      <div className="text-sm">
                                        <div className="font-medium text-red-700">
                                          {formatDateForDisplay(occ.startDate)}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          to {formatDateForDisplay(occ.endDate)}
                                        </div>
                                      </div>
                                      <div className="flex items-center">
                                        <span className="mr-2 text-sm font-bold text-gray-800">
                                          {occ.userCount ?? 0} users registered
                                        </span>
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
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                No cancelled workshop dates
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage>{actionData?.errors?.occurrences}</FormMessage>
              </FormItem>
            )}
          />

          {/* New Prerequisites Field */}
          <FormField
            control={form.control}
            name="prerequisites"
            render={() => (
              <FormItem>
                <FormLabel>Prerequisites</FormLabel>
                <FormControl>
                  {getWorkshopPrerequsities(
                    availableWorkshops,
                    selectedPrerequisites,
                    handlePrerequisiteSelect,
                    removePrerequisite,
                    workshop.id
                  )}
                </FormControl>
                <FormMessage>{actionData?.errors?.prerequisites}</FormMessage>
              </FormItem>
            )}
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
