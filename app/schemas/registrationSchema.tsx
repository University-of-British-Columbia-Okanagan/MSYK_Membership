import { z } from "zod";
import {
  calculateAge,
  isTooYoungToRegister,
  requiresGuardian,
  MINIMUM_REGISTRATION_AGE,
} from "~/utils/age";

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
      .refine((date) => calculateAge(date) !== null, {
        message: "Please enter a valid date of birth",
      })
      .refine((date) => !isTooYoungToRegister(calculateAge(date)), {
        message: `Makers under ${MINIMUM_REGISTRATION_AGE} are a bit too young to register for the portal. You can talk to your parent or guardian about registering and participating with you`,
      }),

    // Only collected from 14 to 17 year olds. Required for them, dropped for everyone else.
    guardianName: z.string().optional(),

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
  })
  .superRefine((data, ctx) => {
    if (!requiresGuardian(calculateAge(data.dateOfBirth))) return;

    if (!data.guardianName || data.guardianName.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guardianName"],
        message: "Please enter your legal guardian's full name",
      });
    }
  })
  .transform((data) => {
    // The field is hidden again if the user changes their birth year, so a stale value can
    // still be posted. Only keep it for the band that actually needs it.
    const guardianName = requiresGuardian(calculateAge(data.dateOfBirth))
      ? data.guardianName?.trim()
      : undefined;

    return { ...data, guardianName };
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
