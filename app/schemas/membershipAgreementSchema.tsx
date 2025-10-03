import { z } from "zod";

export const membershipAgreementSchema = z.object({
  agreementSignature: z
    .string()
    .min(1, "Digital signature is required for the membership agreement"),
});

export type MembershipAgreementFormValues = z.infer<typeof membershipAgreementSchema>;