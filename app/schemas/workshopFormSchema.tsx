import { z } from "zod";

export const workshopFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be a positive number"),
  location: z.string().min(1, "Location is required"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  type: z.enum(["workshop", "orientation"]),

  occurrences: z
    .array(
      z.object({
        id: z.number().optional(),
        status: z.string().optional(),
        userCount: z.number().optional(),

        startDate: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
          message: "Invalid start date format",
        }),
        endDate: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
          message: "Invalid end date format",
        }),
        startDatePST: z.coerce.date().optional(),
        endDatePST: z.coerce.date().optional(),
      })
    )
    .min(1, "At least one occurrence is required")
    .refine(
      (occurrences) =>
        occurrences.every(
          (occ) => occ.endDate.getTime() > occ.startDate.getTime()
        ),
      {
        message: "End date must be later than start date",
        path: ["occurrences"], // This error appears on the occurrences field
      }
    ),
  prerequisites: z.array(z.number()).optional(),
  equipments: z.array(z.number()).optional(),
  isMultiDayWorkshop: z.boolean().optional().default(false),
});

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;
