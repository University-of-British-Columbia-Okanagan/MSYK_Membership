import { z } from "zod";

export const membershipPlanFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  price: z
    .number()
    .min(0, "Price must be at least 0") // Allow 0 or more
    .default(0), // Default value is 0
    features: z.array(z.string())
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanFormSchema>;
