import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z.string().min(1, "First Name is required"),
    lastName: z.string().min(1, "Last Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password is required and must be at least 6 characters"),
    phone: z.string().min(1, "Phone is required"),
    address: z.string().min(1, "Address is required"),

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
    guardianSignedConsent: z.any().nullable(),
    // guardianSignedConsent: z.any().nullable().refine((val) => val, {
    //   message: "You must attach a file",
    // }), // Allow null for file

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
    trainingCardUserNumber: z.number({
      required_error: "Training Card/User Number is required",
    }),
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
  .refine(
    (data) => data.over18 || data.guardianSignedConsent,
    {
      path: ["guardianSignedConsent"],
      message: "Guardian Signed Consent is required if you not over 18.",
    }
  )
  // .superRefine((data, ctx) => {
  //   if (!data.parentGuardianEmail || data.parentGuardianEmail === "") {
  //     ctx.addIssue({
  //       path: ["parentGuardianEmail"],
  //       code: z.ZodIssueCode.custom,
  //       message: "Parent/Guardian Email is required if you are not over 18",
  //     });
  //   }
  // });
  // Ensure `photoRelease` is true
  // .refine((data) => data.photoRelease, {
  //   path: ["photoRelease"],
  //   message: "You must consent to the Photo Release policy.",
  // })
  // // Ensure `dataPrivacy` is true
  // .refine((data) => data.dataPrivacy, {
  //   path: ["dataPrivacy"],
  //   message: "You must agree to the Data Privacy policy.",
  // });

export type RegisterFormValues = z.infer<typeof registerSchema>;