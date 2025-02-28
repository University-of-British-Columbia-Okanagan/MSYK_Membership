import { z } from "zod";

export const equipmentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be a positive value"),
  availability: z.enum(["true", "false"]),
});

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;
