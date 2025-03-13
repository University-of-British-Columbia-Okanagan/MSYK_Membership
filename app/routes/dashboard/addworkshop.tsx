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
import { Badge } from "~/components/ui/badge";
import GenericFormField from "~/components/ui/GenericFormField";
import DateTypeRadioGroup from "~/components/ui/DateTypeRadioGroup";
import OccurrenceRow from "~/components/ui/OccurrenceRow";
import RepetitionScheduleInputs from "@/components/ui/RepetitionScheduleInputs";
import OccurrencesTabs from "~/components/ui/OccurrenceTabs";
import PrerequisitesField from "@/components/ui/PrerequisitesField";
import { getAvailableEquipmentForAdmin } from "~/models/equipment.server";
import MultiSelectField from "~/components/ui/MultiSelectField";

/**
 * Loader to fetch available workshops for prerequisites.
 */
export async function loader() {
  const workshops = await getWorkshops();
  const equipments = await getAvailableEquipmentForAdmin();

  return { workshops, equipments };
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

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

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
            slot.workshop !== null // 🛑 Fix: Check if already assigned to a workshop
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

  //  Validate form data using Zod schema
  const parsed = workshopFormSchema.safeParse({
    ...rawValues,
    price,
    capacity,
    occurrences,
    prerequisites,
    equipments,
  });

  if (!parsed.success) {
    console.log("Validation Errors:", parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  //  Save the workshop to the database
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
      equipments: parsed.data.equipments,
    });
  } catch (error) {
    console.error("Error adding workshop:", error);
    return { errors: { database: ["Failed to add workshop"] } };
  }

  // Redirect to admin dashboard
  return redirect("/dashboard/admin");
}

export default function AddWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { workshops: availableWorkshops, equipments: availableEquipments } =
    useLoaderData() as {
      workshops: { id: number; name: string; type: string }[];
      equipments: { id: number; name: string }[];
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

  // This will track the selected prerequisites
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<number[]>(
    []
  );
  const sortedSelectedPrerequisites = [...selectedPrerequisites].sort(
    (a, b) => a - b
  );

  const [selectedEquipments, setSelectedEquipments] = useState<number[]>([]);

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

  const handleEquipmentSelect = (id: number) => {
    if (selectedEquipments.includes(id)) {
      setSelectedEquipments(selectedEquipments.filter((e) => e !== id));
    } else {
      const updated = [...selectedEquipments, id];
      setSelectedEquipments(updated);
      form.setValue("equipments", updated);
    }
  };

  const removeEquipment = (id: number) => {
    const updated = selectedEquipments.filter((e) => e !== id);
    setSelectedEquipments(updated);
    form.setValue("equipments", updated);
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

                    {/* Custom Dates Input */}
                    {dateSelectionType === "custom" && (
                      <div className="flex flex-col items-center w-full">
                        {occurrences.map((occ, index) => (
                          <OccurrenceRow
                            key={index}
                            index={index}
                            occurrence={occ}
                            updateOccurrence={updateOccurrence}
                            formatLocalDatetime={formatLocalDatetime}
                          />
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

                    {dateSelectionType === "weekly" && (
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
                        onRevert={() => setDateSelectionType("custom")}
                      />
                    )}

                    {/* Monthly Repetition */}
                    {dateSelectionType === "monthly" && (
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
                        onRevert={() => setDateSelectionType("custom")}
                      />
                    )}

                    {/* If we have occurrences, show them in a single tab */}
                    {occurrences.length > 0 && (
                      <>
                        <h3 className="font-medium mb-4">Dates:</h3>
                        <OccurrencesTabs
                          defaultValue="all"
                          tabs={[
                            {
                              value: "all",
                              label: "My Workshop Dates",
                              content: (
                                <>
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
                                        onConfirm={() =>
                                          removeOccurrence(index)
                                        }
                                        buttonLabel="X"
                                        buttonClassName="bg-red-500 hover:bg-red-600 text-white h-8 px-3 rounded-full"
                                      />
                                    </div>
                                  ))}
                                </>
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
            label="Equipments"
            options={availableEquipments} // from loader
            selectedItems={selectedEquipments}
            onSelect={handleEquipmentSelect}
            onRemove={removeEquipment}
            error={actionData?.errors?.equipments}
            placeholder="Select equipments..."
            helperText="Choose equipment required for this workshop/orientation."
          />

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
          {/* Hidden input for equipments */}
          <input
            type="hidden"
            name="equipments"
            value={JSON.stringify(selectedEquipments || [])}
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
