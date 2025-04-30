import React, { useState, useEffect } from "react";
import { useLoaderData, redirect, useActionData } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import OccurrenceRow from "~/components/ui/OccurrenceRow";
import DateTypeRadioGroup from "~/components/ui/DateTypeRadioGroup";
import RepetitionScheduleInputs from "@/components/ui/RepetitionScheduleInputs";
import { getWorkshopById, offerWorkshopAgain } from "~/models/workshop.server";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  CalendarDays as CalendarDaysIcon,
  CalendarRange as CalendarRangeIcon,
} from "lucide-react";

// Schema for workshop offer form
const workshopOfferSchema = z.object({
  occurrences: z.array(
    z.object({
      startDate: z.date().refine(date => !isNaN(date.getTime()), {
        message: "Start date is required"
      }),
      endDate: z.date().refine(date => !isNaN(date.getTime()), {
        message: "End date is required"
      }),
      startDatePST: z.date().optional(),
      endDatePST: z.date().optional()
    })
  ).min(1, "At least one date is required")
});

type WorkshopOfferValues = z.infer<typeof workshopOfferSchema>;

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

// ─────────────────────────────────────────────────────────────────────────────
//  3) Loader
// ─────────────────────────────────────────────────────────────────────────────
export async function loader({ params }: { params: { id: string } }) {
  const workshopId = Number(params.id);
  
  // Get workshop details including existing occurrences
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }
  
  return { workshopId, workshop };
}

// ─────────────────────────────────────────────────────────────────────────────
//  4) Action
// ─────────────────────────────────────────────────────────────────────────────
export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries()) as Record<string, string>;
  
  // Parse occurrences from JSON string
  let occurrences: { 
    startDate: Date; 
    endDate: Date; 
    startDatePST: Date; 
    endDatePST: Date; 
  }[] = [];
  
  try {
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: { startDate: string; endDate: string; startDatePST: string; endDatePST: string }) => {
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

  // Validate with zod schema
  const parsed = workshopOfferSchema.safeParse({
    occurrences: occurrences.map(occ => ({
      startDate: occ.startDate,
      endDate: occ.endDate,
      startDatePST: occ.startDatePST,
      endDatePST: occ.endDatePST
    }))
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  
  const workshopId = Number(params.id);

  // Add new occurrences with the same workshop ID but a new offerId
  await offerWorkshopAgain(workshopId, occurrences);

  return redirect(`/dashboard/workshops/`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  5) WorkshopOfferAgain Component
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkshopOfferAgain() {
  const { workshopId, workshop } = useLoaderData() as {
    workshopId: number;
    workshop: any;
  };
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();

  // State for occurrences - pre-populated with existing workshop dates
  const [occurrences, setOccurrences] = useState<
    { startDate: Date; endDate: Date; startDatePST?: Date; endDatePST?: Date }[]
  >(() => {
    // Pre-populate with the workshop's existing occurrences
    if (workshop.occurrences && workshop.occurrences.length > 0) {
      return workshop.occurrences.map((occ: any) => ({
        startDate: new Date(occ.startDate),
        endDate: new Date(occ.endDate),
        startDatePST: occ.startDatePST ? new Date(occ.startDatePST) : undefined,
        endDatePST: occ.endDatePST ? new Date(occ.endDatePST) : undefined
      })).filter((occ: any) => 
        !isNaN(occ.startDate.getTime()) && 
        !isNaN(occ.endDate.getTime())
      );
    }
    return [];
  });
  
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

  const form = useForm<WorkshopOfferValues>({
    resolver: zodResolver(workshopOfferSchema),
    defaultValues: {
      occurrences: occurrences
    },
  });

  // Update form with pre-populated occurrences
  useEffect(() => {
    // Update the form with pre-populated occurrences
    if (occurrences.length > 0) {
      form.setValue("occurrences", occurrences);
    }
  }, [form, form.setValue]);

  // For custom dates, add an empty occurrence
  const addOccurrence = () => {
    const newOccurrence = { 
      startDate: new Date(""), 
      endDate: new Date("") 
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
    
    // Calculate PST dates when updating
    if (field === "startDate" && !isNaN(localDate.getTime())) {
      const startOffset = localDate.getTimezoneOffset();
      updatedOccurrences[index].startDatePST = new Date(localDate.getTime() - startOffset * 60000);
    } else if (field === "endDate" && !isNaN(localDate.getTime())) {
      const endOffset = localDate.getTimezoneOffset();
      updatedOccurrences[index].endDatePST = new Date(localDate.getTime() - endOffset * 60000);
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
  const isDuplicateDate = (newDate: Date, existingDates: Date[]): boolean => {
    return existingDates.some(
      (existingDate) => existingDate.getTime() === newDate.getTime()
    );
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

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">
        Create New Offering: {workshop.name}
      </h1>

      {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted fields below.
        </div>
      )}

      <div className="mb-8 bg-yellow-50 p-4 border border-yellow-200 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Offering Workshop Again</h2>
        <p className="text-sm text-gray-700 mb-2">
          We've pre-filled the dates from the current workshop schedule. You can modify these dates or add new ones as needed.
        </p>
        <p className="text-sm text-gray-700">
          When you submit this form, a new set of workshop occurrences will be created with these dates.
        </p>
      </div>

      <Form {...form}>
        <form method="post" className="space-y-6">
          {/* Workshop Dates Section */}
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
                    {occurrences.map((occ, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-white border-b last:border-b-0 hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {formatDisplayDate(occ.startDate)}
                          </div>
                          <div className="text-sm text-gray-600">
                            to {formatDisplayDate(occ.endDate)}
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
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <FormMessage>{actionData?.errors?.occurrences}</FormMessage>
          </FormItem>

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
                  const startDatePST = occ.startDatePST || new Date(occ.startDate.getTime() - startOffset * 60000);
                  
                  const endOffset = occ.endDate.getTimezoneOffset();
                  const endDatePST = occ.endDatePST || new Date(occ.endDate.getTime() - endOffset * 60000);
                  
                  return {
                    startDate: occ.startDate.toISOString(),
                    endDate: occ.endDate.toISOString(),
                    startDatePST: startDatePST.toISOString(),
                    endDatePST: endDatePST.toISOString()
                  };
                })
            )}
          />

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
              disabled={occurrences.length === 0}
            >
              Create New Offering
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}