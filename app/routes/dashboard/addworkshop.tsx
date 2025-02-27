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
import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Loader to fetch available workshops for prerequisites.
 */
export async function loader() {
  const workshops = await getWorkshops();
  return { workshops };
}

/**
 * Helper: Parse a datetime-local string as a local Date.
 */
function parseDateTimeAsLocal(value: string): Date {
  if (!value) return new Date("");
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
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

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);

  // Parse prerequisites from JSON string to array of numbers
  let prerequisites: number[] = [];
  try {
    prerequisites = JSON.parse(rawValues.prerequisites as string).map(Number);
  } catch (error) {
    console.error("Error parsing prerequisites:", error);
    return { errors: { prerequisites: ["Invalid prerequisites format"] } };
  }

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
        if (isNaN(localStart.getTime()) || isNaN(localEnd.getTime())) {
          throw new Error("Invalid date format");
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
    console.log("Validation Errors:", parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await addWorkshop({
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
    console.error("Error adding workshop:", error);
    return { errors: { database: ["Failed to add workshop"] } };
  }

  return redirect("/dashboard/admin");
}

export default function AddWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { workshops: availableWorkshops } = useLoaderData() as {
    workshops: { id: number; name: string }[];
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
    },
  });

  // Occurrences will be stored as local Date objects.
  const [occurrences, setOccurrences] = useState<
    { startDate: Date; endDate: Date }[]
  >([]);
  const [dateSelectionType, setDateSelectionType] = useState<
    "custom" | "weekly" | "monthly"
  >("custom");

  // This will track the selected prerequisites
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<number[]>(
    []
  );
  const sortedSelectedPrerequisites = [...selectedPrerequisites].sort(
    (a, b) => a - b
  );

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
        <form method="post">
          {/* Workshop Fields */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="name"
                    placeholder="Workshop Name"
                    {...field}
                    className="w-full lg:w-[500px]"
                    autoComplete="off"
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
                <FormLabel htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    id="description"
                    placeholder="Workshop Description"
                    {...field}
                    className="w-full"
                    rows={5}
                    autoComplete="off"
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
                <FormLabel htmlFor="price">
                  Price <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="price"
                    type="number"
                    placeholder="Price"
                    {...field}
                    step="0.01"
                    className="w-full"
                    autoComplete="off"
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
                <FormLabel htmlFor="location">
                  Location <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="location"
                    placeholder="Workshop Location"
                    {...field}
                    className="w-full"
                    autoComplete="off"
                  />
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
                <FormLabel htmlFor="capacity">
                  Capacity <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="Capacity"
                    {...field}
                    className="w-full"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.capacity}</FormMessage>
              </FormItem>
            )}
          />

          {/* Occurrences (Dates) Section */}
          <FormField
            control={form.control}
            name="occurrences"
            render={() => (
              <FormItem className="mt-6">
                <FormLabel htmlFor="occurrences">
                  Workshop Dates <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <div className="flex flex-col items-start space-y-4 w-full">
                    {/* Radio Buttons for selecting date input type */}
                    <div className="flex flex-col items-start gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="customDate"
                          name="dateType"
                          value="custom"
                          checked={dateSelectionType === "custom"}
                          onChange={() => setDateSelectionType("custom")}
                        />
                        <label htmlFor="customDate" className="text-sm">
                          Enter dates
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="weeklyDate"
                          name="dateType"
                          value="weekly"
                          checked={dateSelectionType === "weekly"}
                          onChange={() => setDateSelectionType("weekly")}
                        />
                        <label htmlFor="weeklyDate" className="text-sm">
                          Append/add weekly dates
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="monthlyDate"
                          name="dateType"
                          value="monthly"
                          checked={dateSelectionType === "monthly"}
                          onChange={() => setDateSelectionType("monthly")}
                        />
                        <label htmlFor="monthlyDate" className="text-sm">
                            Append/add monthly dates
                        </label>
                      </div>
                    </div>

                    {/* Custom Dates Input */}
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
                            {/* You could also add a confirm delete here if desired */}
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

                    {/* Weekly Schedule Inputs */}
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
                              placeholder="Week interval"
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
                              placeholder="Total occurrences"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!weeklyStartDate || !weeklyEndDate) {
                              alert(
                                "Please select initial start and end dates"
                              );
                              return;
                            }
                            if (weeklyInterval < 1 || weeklyCount < 1) {
                              alert(
                                "Please enter valid interval and repetition numbers"
                              );
                              return;
                            }
                            const newOccurrences: {
                              startDate: Date;
                              endDate: Date;
                            }[] = [];
                            const start = parseDateTimeAsLocal(weeklyStartDate);
                            const end = parseDateTimeAsLocal(weeklyEndDate);
                            const baseOccurrence = {
                              startDate: new Date(start),
                              endDate: new Date(end),
                            };
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
                              // Prevent duplicate dates.
                              const existingStartDates = occurrences.map(
                                (o) => o.startDate
                              );
                              if (
                                !isDuplicateDate(
                                  occurrence.startDate,
                                  existingStartDates
                                )
                              ) {
                                newOccurrences.push(occurrence);
                              }
                            }
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
                            // After appending, revert back to custom view.
                            setDateSelectionType("custom");
                          }}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                        >
                          Append/add weekly dates
                        </Button>
                      </div>
                    )}

                    {/* Monthly Schedule Inputs */}
                    {dateSelectionType === "monthly" && (
                      <div className="flex flex-col items-start w-full space-y-4">
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
                              alert(
                                "Please enter valid interval and repetition numbers"
                              );
                              return;
                            }
                            const newOccurrences: {
                              startDate: Date;
                              endDate: Date;
                            }[] = [];
                            const start =
                              parseDateTimeAsLocal(monthlyStartDate);
                            const end = parseDateTimeAsLocal(monthlyEndDate);
                            const baseOccurrence = {
                              startDate: new Date(start),
                              endDate: new Date(end),
                            };
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
                              newOccurrences.push(occurrence);
                            }
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
                            // Revert back to custom view
                            setDateSelectionType("custom");
                          }}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                        >
                          Append/add monthly dates
                        </Button>
                      </div>
                    )}

                    {/* If we have occurrences, show them in a single tab */}
                    {occurrences.length > 0 && (
                      <div className="w-full mt-4">
                        <h3 className="font-medium mb-4">Dates:</h3>
                        <Tabs defaultValue="all" className="w-full">
                          {/* Center the tab trigger */}
                          <TabsList className="flex justify-center">
                            <TabsTrigger value="all">
                              My Workshop Dates
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent
                            value="all"
                            className="border rounded-md p-4 mt-2"
                          >
                            {occurrences.map((occ, index) => (
                              <div
                                key={index}
                                className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-md mb-2"
                              >
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {formatDisplayDate(occ.startDate)}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    to {formatDisplayDate(occ.endDate)}
                                  </div>
                                </div>
                                <ConfirmButton
                                  confirmTitle="Delete Occurrence"
                                  confirmDescription="Are you sure you want to delete this occurrence?"
                                  onConfirm={() => removeOccurrence(index)}
                                  buttonLabel="X"
                                  buttonClassName="bg-red-500 hover:bg-red-600 text-white h-8 px-3 rounded-full"
                                />
                              </div>
                            ))}
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

          {/* Prerequisites */}
          <FormField
            control={form.control}
            name="prerequisites"
            render={({ field }) => (
              <FormItem className="">
                <FormLabel>Prerequisites</FormLabel>
                <FormControl>
                  <div className="">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {sortedSelectedPrerequisites.map((prereqId) => {
                        const workshop = availableWorkshops.find(
                          (w) => w.id === prereqId
                        );
                        return workshop ? (
                          <Badge
                            key={prereqId}
                            variant="secondary"
                            className="py-1 px-2"
                          >
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
                      onValueChange={(value) =>
                        handlePrerequisiteSelect(Number(value))
                      }
                      value=""
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select prerequisites..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWorkshops
                          .filter(
                            (workshop) =>
                              !selectedPrerequisites.includes(workshop.id)
                          )
                          .sort((a, b) => a.id - b.id)
                          .map((workshop) => (
                            <SelectItem
                              key={workshop.id}
                              value={workshop.id.toString()}
                            >
                              {workshop.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FormControl>
                <FormMessage>{actionData?.errors?.prerequisites}</FormMessage>
                <div className="text-xs text-gray-500 mt-1">
                  Select workshops that must be completed before enrolling in
                  this one
                </div>
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

          {/* Hidden input for occurrences */}
          <input
            type="hidden"
            name="occurrences"
            value={JSON.stringify(
              occurrences.filter(
                (occ) =>
                  !isNaN(occ.startDate.getTime()) &&
                  !isNaN(occ.endDate.getTime())
              )
            )}
          />
          {/* Hidden input for prerequisites */}
          <input
            type="hidden"
            name="prerequisites"
            value={JSON.stringify(selectedPrerequisites || [])}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
          >
            Submit
          </Button>
        </form>
      </Form>
    </div>
  );
}
