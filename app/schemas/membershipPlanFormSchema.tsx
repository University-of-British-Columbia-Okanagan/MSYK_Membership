import { z } from "zod";

export const membershipPlanFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z
    .number()
    .min(0, "Price must be at least 0") // Allow 0 or more
    .default(0), // Default value is 0
  features: z
    .array(z.string().min(1, "Feature cannot be empty")) // Ensure each feature is non-empty
    .min(1, "At least one feature is required"), // Ensure at least one feature is present
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanFormSchema>;
