import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Invalid password"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
