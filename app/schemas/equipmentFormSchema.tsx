import { z } from "zod";

export const equipmentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce
    .number({ invalid_type_error: "Price must be a number" })
    .min(0, "Price must be a positive value"),
  availability: z.enum(["true", "false"]),
  workshopPrerequisites: z.array(z.number()).optional(),
});

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;
