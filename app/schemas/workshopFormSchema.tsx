import { z } from "zod";

export const workshopFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be a positive number"),
  eventDate: z
    .string()
    .min(1, "Event date and time is required.")
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  location: z.string().min(1, "Location is required"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  status: z.enum(["upcoming", "ongoing", "completed"])
});

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;