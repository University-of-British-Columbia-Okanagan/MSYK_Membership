import { z } from "zod";

// Schema for workshop offer form
export const workshopOfferSchema = z.object({
  occurrences: z
    .array(
      z.object({
        startDate: z.date().refine((date) => !isNaN(date.getTime()), {
          message: "Start date is required",
        }),
        endDate: z.date().refine((date) => !isNaN(date.getTime()), {
          message: "End date is required",
        }),
        startDatePST: z.date().optional(),
        endDatePST: z.date().optional(),
      })
    )
    .min(1, "At least one date is required")
    .refine(
      (occurrences) =>
        occurrences.every(
          (occ) => occ.endDate.getTime() > occ.startDate.getTime()
        ),
      {
        message: "End date must be later than start date",
        path: ["occurrences"],
      }
    ),
});

export type WorkshopOfferValues = z.infer<typeof workshopOfferSchema>;
