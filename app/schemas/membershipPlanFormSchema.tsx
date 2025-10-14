import { z } from "zod";

export const membershipPlanFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be at least 0").default(0),
  price3Months: z
    .number()
    .min(0, "3-month price must be at least 0")
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || val > 0, {
      message: "3-month price must be greater than 0 if provided",
    }),
  price6Months: z
    .number()
    .min(0, "6-month price must be at least 0")
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || val > 0, {
      message: "6-month price must be greater than 0 if provided",
    }),
  priceYearly: z
    .number()
    .min(0, "Yearly price must be at least 0")
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || val > 0, {
      message: "Yearly price must be greater than 0 if provided",
    }),
  features: z
    .array(z.string().min(1, "Feature cannot be empty"))
    .min(1, "At least one feature is required"),
  // needAdminPermission: z.boolean().optional().default(false),
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanFormSchema>;
