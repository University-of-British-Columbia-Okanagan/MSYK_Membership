import React from "react";
import { useLoaderData, useActionData } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editOccurrenceSchema } from "../../schemas/editOccurrenceSchema";
import type { OccurrenceEditValues } from "../../schemas/editOccurrenceSchema";
import {
  getWorkshopOccurrence,
  duplicateOccurrence,
} from "~/models/workshop.server";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { redirect } from "react-router";

// ─────────────────────────────────────────────────────────────────────────────
//  Loader: Fetch the occurrence data
// ─────────────────────────────────────────────────────────────────────────────
export async function loader({
  params,
}: {
  params: { id: string; occurrenceId: string };
}) {
  const workshopId = Number(params.id);
  const occurrenceId = Number(params.occurrenceId);

  const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
  if (!occurrence) {
    throw new Response("Occurrence not found", { status: 404 });
  }
  return { workshopId, occurrenceId, occurrence };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string; occurrenceId: string };
}) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  // Destructure the fields you want to parse
  const { startDate, endDate } = rawValues;

  // Now pass them at the top level:
  const parsed = editOccurrenceSchema.safeParse({
    startDate,
    endDate,
  });

  console.log(rawValues);
  console.log(parsed);

  if (!parsed.success) {
    console.log(parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const workshopId = Number(params.id);
  const occurrenceId = Number(params.occurrenceId);

  const parsedStartDate = parsed.data.startDate;
  const parsedEndDate = parsed.data.endDate;

  // Shift local times to UTC (optional logic)
  const startOffset = parsedStartDate.getTimezoneOffset();
  const startDatePST = new Date(
    parsedStartDate.getTime() - startOffset * 60000
  );
  const endOffset = parsedEndDate.getTimezoneOffset();
  const endDatePST = new Date(parsedEndDate.getTime() - endOffset * 60000);

  // Pass the correct keys for startDate and endDate
  await duplicateOccurrence(workshopId, occurrenceId, {
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    startDatePST,
    endDatePST,
  });

  return redirect(`/dashboard/workshops/${workshopId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper to format a Date as datetime-local (YYYY-MM-DDTHH:mm)
// ─────────────────────────────────────────────────────────────────────────────
function formatLocalDatetime(dateInput: Date | string): string {
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
//  EditOccurrence Component
// ─────────────────────────────────────────────────────────────────────────────
export default function EditOccurrence() {
  const { workshopId, occurrence, occurrenceId } = useLoaderData() as {
    workshopId: number;
    occurrenceId: number;
    occurrence: { startDate: Date; endDate: Date };
  };

  const actionData = useActionData<{ errors?: Record<string, string[]> }>();

  // Set up React Hook Form
  const form = useForm<OccurrenceEditValues>({
    resolver: zodResolver(editOccurrenceSchema),
    defaultValues: {
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">
        Offer New Workshop Date
      </h1>

      {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post" className="space-y-4">
          {/* Start Date */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    value={formatLocalDatetime(field.value)}
                    onChange={(e) => {
                      // Convert the string value back to a Date
                      field.onChange(new Date(e.target.value));
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <FormMessage>
                  {/* {form.formState.errors.startDate?.message} */}
                  {actionData?.errors?.startDate}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* End Date */}
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    value={formatLocalDatetime(field.value)}
                    onChange={(e) => {
                      field.onChange(new Date(e.target.value));
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <FormMessage>
                  {/* {form.formState.errors.endDate?.message} */}
                  {actionData?.errors?.endDate}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Submit Button (centered & styled in yellow) */}
          <div className="flex justify-center">
            <Button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
            >
              Offer Again
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
