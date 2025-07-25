import React from "react";
import { useLoaderData, useActionData } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editOccurrenceSchema } from "./editOccurrenceSchema";
import type { OccurrenceEditValues } from "./editOccurrenceSchema";
import { getWorkshopOccurrence, duplicateOccurrence } from "~/models/workshop.server";
import {
  Form,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { redirect } from "react-router";
import GenericFormField from "~/components/ui/Dashboard/GenericFormField";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";

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
export async function loader({
  params,
}: {
  params: { id: string; occurrenceId: string };
}) {
  const workshopId = Number(params.id);
  const occurrenceId = Number(params.occurrenceId);

  logger.info("Loading workshop occurrence", {
    context: "workshop-occurrence-loader",
    workshopId,
    occurrenceId,
  });

  const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
  if (!occurrence) {
    logger.warn("Workshop occurrence not found", {
      context: "workshop-occurrence-loader",
      workshopId,
      occurrenceId,
    });
    throw new Response("Occurrence not found", { status: 404 });
  }

  logger.info("Workshop occurrence loaded successfully", {
    context: "workshop-occurrence-loader",
    workshopId,
    occurrenceId,
  });

  return { workshopId, occurrenceId, occurrence };
}

// ─────────────────────────────────────────────────────────────────────────────
//  4) Action: parse the string values, shift them to UTC if desired
// ─────────────────────────────────────────────────────────────────────────────
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string; occurrenceId: string };
}) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized duplicateOccurrence action", {
      url: request.url,
    });
    throw new Response("Not Authorized", { status: 419 });
  }
  
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries()) as Record<string, string>;

  // Convert the string to a Date
  const parsedStart = parseDateTimeAsLocal(rawValues.startDate);
  const parsedEnd = parseDateTimeAsLocal(rawValues.endDate);

  // Validate with zod
  const parsed = editOccurrenceSchema.safeParse({
    startDate: parsedStart,
    endDate: parsedEnd,
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // If you need to shift to UTC (or PST), do so here
  const startOffset = parsedStart.getTimezoneOffset();
  const startDatePST = new Date(parsedStart.getTime() - startOffset * 60000);
  const endOffset = parsedEnd.getTimezoneOffset();
  const endDatePST = new Date(parsedEnd.getTime() - endOffset * 60000);

  const workshopId = Number(params.id);
  const occurrenceId = Number(params.occurrenceId);

  await duplicateOccurrence(workshopId, occurrenceId, {
    startDate: parsedStart,
    endDate: parsedEnd,
    startDatePST,
    endDatePST,
  });

  logger.info("Successfully duplicated occurrence", {
    url: request.url,
  });

  return redirect(`/dashboard/workshops/${workshopId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  5) EditOccurrence Component
// ─────────────────────────────────────────────────────────────────────────────
export default function EditOccurrence() {
  const { workshopId, occurrence, occurrenceId } = useLoaderData() as {
    workshopId: number;
    occurrenceId: number;
    occurrence: { startDate: Date; endDate: Date };
  };
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();

  // Use default values as Date objects (matching your schema)
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
          There are some errors in your form. Please review the highlighted fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post" className="space-y-4">
          {/* Start Date Field */}
          <GenericFormField
            control={form.control}
            name="startDate"
            label="Start Date"
            required
            type="datetime-local"
            error={actionData?.errors?.startDate}
          />

          {/* End Date Field */}
          <GenericFormField
            control={form.control}
            name="endDate"
            label="End Date"
            required
            type="datetime-local"
            error={actionData?.errors?.endDate}
          />

          {/* Submit Button */}
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