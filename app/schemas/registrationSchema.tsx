import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z.string().min(1, "First Name is required"),
    lastName: z.string().min(1, "Last Name is required"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password is required and must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    phone: z.string().min(1, "Phone is required"),

    over18: z.boolean(),
    parentGuardianName: z
      .string()
      .min(1, "Parent/Guardian Name is required")
      .nullable(),
    parentGuardianPhone: z
      .string()
      .min(1, "Parent/Guardian Phone is required")
      .nullable(),
    parentGuardianEmail: z
      .string()
      .email("Invalid Parent/Guardian Email")
      .nullable(),
    guardianSignedConsent: z.string().nullable(),

    photoRelease: z.boolean(),
    dataPrivacy: z.boolean().refine((val) => val, {
      message: "You must agree to the Data Privacy policy",
    }),
    emergencyContactName: z
      .string()
      .min(1, "Emergency Contact Name is required"),
    emergencyContactPhone: z
      .string()
      .min(1, "Emergency Contact Phone is required"),
    emergencyContactEmail: z.string().email("Invalid Emergency Contact Email"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine(
    (data) =>
      data.over18 ||
      (data.parentGuardianName &&
        data.parentGuardianPhone &&
        data.parentGuardianEmail &&
        data.guardianSignedConsent),
    {
      path: ["parentGuardianFields"],
      message:
        "Parent/Guardian fields and signed consent are required you are not over 18",
    }
  )
  // Ensure `guardianSignedConsent` is required if `over18` is false
  .refine((data) => data.over18 || data.guardianSignedConsent, {
    path: ["guardianSignedConsent"],
    message: "Guardian Digital Signature is required if you not over 18.",
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
