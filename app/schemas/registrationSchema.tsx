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

    dateOfBirth: z
      .string()
      .min(1, "Date of Birth is required")
      .refine(
        (date) => {
          const birthDate = new Date(date);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();

          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            age--;
          }

          return age >= 18;
        },
        {
          message:
            ". You must be 18 or older to complete online registration. Please visit the makerspace with a parent/guardian to register",
        }
      ),

    emergencyContactName: z
      .string()
      .min(1, "Emergency Contact Name is required"),
    emergencyContactPhone: z
      .string()
      .min(1, "Emergency Contact Phone is required"),
    emergencyContactEmail: z.string().email("Invalid Emergency Contact Email"),

    mediaConsent: z.boolean({
      required_error: "Media consent selection is required",
    }),

    dataPrivacy: z.boolean().refine((val) => val, {
      message: "You must agree to the Data Privacy policy",
    }),

    communityGuidelines: z.boolean().refine((val) => val, {
      message: "You must agree to follow the MSYK Community Guidelines",
    }),

    operationsPolicy: z.boolean().refine((val) => val, {
      message:
        "You must agree to follow the MSYK User Operations & Safety Policy",
    }),

    waiverSignature: z
      .string()
      .min(1, "Digital signature is required for the waiver agreement"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
