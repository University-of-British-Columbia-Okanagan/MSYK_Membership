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
} from "~/models/workshop.server";

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

  if (!workshop) {
    throw new Response("Workshop Not Found", { status: 404 });
  }

  return {
    ...workshop,
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

  // Convert price & capacity
  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);

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
  });

  if (!parsed.success) {
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
   4) The EditWorkshop component
   ---------------------------------------------------------------------------*/
export default function EditWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const workshop = useLoaderData<typeof loader>();

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
      type: (workshop.type as "workshop" | "orientation") || "workshop",
      occurrences: initialOccurrences,
    },
  });

  // We store occurrences in local state for the UI
  const [occurrences, setOccurrences] =
    useState<Occurrence[]>(initialOccurrences);

  const activeOccurrences = occurrences.filter(
    (occ) => occ.status === "active"
  );
  const pastOccurrences = occurrences.filter((occ) => occ.status === "past");

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
    setOccurrences((prev) => [
      ...prev,
      { startDate: new Date(""), endDate: new Date("") },
    ]);
  };

  // For custom approach, update a row's start or end
  const updateOccurrence = (
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) => {
    const localDate = parseDateTimeAsLocal(value);
    const updatedOccurrences = [...occurrences];
    updatedOccurrences[index][field] = localDate;
    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  };

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
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Workshop Name"
                    className="w-full lg:w-[500px]"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.name}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Description <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Workshop Description"
                    className="w-full"
                    rows={5}
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.description}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Price <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder="Price"
                    step="0.01"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.price}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Location <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Workshop Location" />
                </FormControl>
                <FormMessage>{actionData?.errors?.location}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Capacity <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="Capacity" />
                </FormControl>
                <FormMessage>{actionData?.errors?.capacity}</FormMessage>
              </FormItem>
            )}
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
                    <div className="flex flex-col items-start gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="dateType"
                          value="custom"
                          checked={dateSelectionType === "custom"}
                          onChange={() => setDateSelectionType("custom")}
                        />
                        <span className="text-sm">Manage dates</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="dateType"
                          value="weekly"
                          checked={dateSelectionType === "weekly"}
                          onChange={() => setDateSelectionType("weekly")}
                        />
                        <span className="text-sm">Append weekly dates</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="dateType"
                          value="monthly"
                          checked={dateSelectionType === "monthly"}
                          onChange={() => setDateSelectionType("monthly")}
                        />
                        <span className="text-sm">Append monthly dates</span>
                      </label>
                    </div>

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
                            setOccurrences(updatedOccurrences);
                            form.setValue("occurrences", updatedOccurrences);
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
                            setOccurrences(updatedOccurrences);
                            form.setValue("occurrences", updatedOccurrences);
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
                          <TabsList className="grid w-full grid-cols-2">
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

                                  // If userCount > 0, show a "Cancel" button; otherwise show an "X"
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

                                      <Button
                                        type="button"
                                        onClick={() => {
                                          if (hasUsers) {
                                            // If you want "cancel" to do something special (e.g. update DB status),
                                            // you'd call a different function or show a modal. For now, just alert:
                                            alert(
                                              "Canceling this occurrence. (Has registered users!)"
                                            );
                                          } else {
                                            // If no users, remove from state
                                            removeOccurrence(originalIndex);
                                          }
                                        }}
                                        className={`${
                                          hasUsers
                                            ? "bg-blue-500 hover:bg-blue-600"
                                            : "bg-red-500 hover:bg-red-600"
                                        } text-white h-8 px-3 rounded-full`}
                                      >
                                        {hasUsers ? "Cancel" : "X"}
                                      </Button>
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
                                  // Find the original index in the complete occurrences array
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
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          removeOccurrence(originalIndex)
                                        }
                                        className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0 rounded-full"
                                      >
                                        X
                                      </Button>
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
                        </Tabs>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage>{actionData?.errors?.occurrences}</FormMessage>
              </FormItem>
            )}
          />

          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Workshop Type <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <select {...field} className="w-full border rounded-md p-2">
                    <option value="workshop">Workshop</option>
                    <option value="orientation">Orientation</option>
                  </select>
                </FormControl>
                <FormMessage>{actionData?.errors?.type}</FormMessage>
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
