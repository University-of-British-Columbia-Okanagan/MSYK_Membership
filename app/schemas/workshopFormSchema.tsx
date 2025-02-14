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
        startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid start date format",
        }),
        endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid end date format",
        }),
      })
    )
    .min(1, "At least one occurrence is required"),
});

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;
