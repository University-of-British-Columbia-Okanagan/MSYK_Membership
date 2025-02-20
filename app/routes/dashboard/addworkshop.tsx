import React, { useState } from "react";
import { redirect, useActionData } from "react-router";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workshopFormSchema } from "../../schemas/workshopFormSchema";
import type { WorkshopFormValues } from "../../schemas/workshopFormSchema";
import { addWorkshop } from "~/models/workshop.server";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);

  // Get occurrences from hidden input field
  let occurrences: { startDate: Date; endDate: Date }[] = [];

  try {
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: { startDate: string; endDate: string }) => {
        const startDate = new Date(occ.startDate);
        const endDate = new Date(occ.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error("Invalid date format");
        }

        return { startDate, endDate };
      }
    );
  } catch (error) {
    console.error("Error parsing occurrences:", error);
    return { errors: { occurrences: ["Invalid date format"] } };
  }

  console.log(occurrences);

  console.log("Parsed occurrences:", occurrences);

  const parsed = workshopFormSchema.safeParse({
    ...rawValues,
    price,
    capacity,
    occurrences,
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
    });
  } catch (error) {
    console.error("Error adding workshop:", error);
    return { errors: { database: ["Failed to add workshop"] } };
  }

  return redirect("/dashboard/admin");
}

export default function AddWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
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
    },
  });

  // Manage occurrences dynamically
  // const [occurrences, setOccurrences] = useState<
  //   { startDate: string; endDate: string }[]
  // >([]);

  const [occurrences, setOccurrences] = useState<
    { startDate: Date; endDate: Date }[]
  >([]);

  const [showCustomDate, setShowCustomDate] = useState(false);

  const [dateSelectionType, setDateSelectionType] = useState<
    "custom" | "weekly"
  >("custom");
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [weeklyCount, setWeeklyCount] = useState(1);
  const [weeklyStartDate, setWeeklyStartDate] = useState("");
  const [weeklyEndDate, setWeeklyEndDate] = useState("");

  // const addOccurrence = () => {
  //   setOccurrences([...occurrences, { startDate: "", endDate: "" }]);
  // };

  // Update your addOccurrence function
  const addOccurrence = () => {
    if (dateSelectionType === "weekly") {
      // Weekly logic remains unchanged
    } else {
      // Only add empty date slots instead of pre-filled dates
      setOccurrences((prev) => [
        ...prev,
        {
          startDate: new Date(""), // Invalid date placeholder
          endDate: new Date(""), // Invalid date placeholder
        },
      ]);
    }
  };

  // Update the updateOccurrence function
  const updateOccurrence = (
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) => {
    if (!value) {
      const updatedOccurrences = [...occurrences];
      updatedOccurrences[index][field] = new Date("");
      setOccurrences(updatedOccurrences);
      form.setValue("occurrences", updatedOccurrences);
      return;
    }

    // Parse input as UTC
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);

    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    const updatedOccurrences = [...occurrences];
    updatedOccurrences[index][field] = utcDate;
    setOccurrences(updatedOccurrences);
    form.setValue("occurrences", updatedOccurrences);
  };

  const removeOccurrence = (index: number) => {
    setOccurrences(occurrences.filter((_, i) => i !== index));
  };

  const formatLocalDatetime = (date: Date) => {
    if (isNaN(date.getTime())) return "";

    // Display UTC values instead of local
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">Add Workshop</h1>

      {hasErrors && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post">
          {/* Name */}
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
          {/* Description */}
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
          {/* Price */}
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
          {/* Location */}
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
          {/* Capacity */}
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

          {/* Workshop Occurrences (Date Selection) */}
          <FormField
            control={form.control}
            name="occurrences"
            render={() => (
              <FormItem>
                <FormLabel htmlFor="occurrences">
                  Workshop Occurrences <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <div className="flex flex-col items-start space-y-4">
                    {/* Radio Buttons */}
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
                          Enter custom dates
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
                          Create weekly schedule
                        </label>
                      </div>
                    </div>

                    {/* Custom Date Inputs */}
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
                                isNaN(occ.endDate.getTime()) // Changed from occ.startDate to occ.endDate
                                  ? ""
                                  : formatLocalDatetime(occ.endDate) // Changed to occ.endDate
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
                            <Button
                              type="button"
                              onClick={() => removeOccurrence(index)}
                              className="bg-red-500 text-white px-2 py-1"
                            >
                              X
                            </Button>
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

                    {/* Weekly Repetition Inputs */}
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
                            // Validate inputs first
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

                            // Generate dates using functional update
                            setOccurrences((prev) => {
                              const newOccurrences: {
                                startDate: Date;
                                endDate: Date;
                              }[] = [];
                              const startDate = new Date(weeklyStartDate);
                              const endDate = new Date(weeklyEndDate);

                              // Create base occurrence
                              const baseOccurrence = {
                                startDate: new Date(startDate),
                                endDate: new Date(endDate),
                              };

                              // Generate subsequent dates
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

                                newOccurrences.push(occurrence);
                              }

                              // Update form values with the latest state
                              // const updatedOccurrences = [
                              //   ...prev,
                              //   ...newOccurrences,
                              // ];
                              // form.setValue("occurrences", updatedOccurrences);

                              // return updatedOccurrences;

                              setOccurrences(newOccurrences);
                              form.setValue("occurrences", newOccurrences);
                              return newOccurrences;
                            });
                          }}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
                        >
                          Generate Weekly Dates
                        </Button>

                        {dateSelectionType === "weekly" &&
                          occurrences.length > 0 && (
                            <div className="mt-4 w-full">
                              <h3 className="font-medium mb-2">
                                Generated Dates:
                              </h3>
                              <div className="space-y-2">
                                {occurrences.map((occ, index) => (
                                  <div key={index} className="text-sm">
                                    {occ.startDate.toLocaleDateString()}{" "}
                                    {occ.startDate.toLocaleTimeString()}
                                    {" - "}
                                    {occ.endDate.toLocaleDateString()}{" "}
                                    {occ.endDate.toLocaleTimeString()}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                <FormLabel htmlFor="type">
                  Workshop Type <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <select
                    id="type"
                    {...field}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="workshop">Workshop</option>
                    <option value="orientation">Orientation</option>
                  </select>
                </FormControl>
                <FormMessage>{actionData?.errors?.type}</FormMessage>
              </FormItem>
            )}
          />
          {/* Hidden Input for Occurrences */}
          {/* <input
            type="hidden"
            name="occurrences"
            value={JSON.stringify(occurrences)}
          /> */}
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
