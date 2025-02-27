import { z } from "zod";

export const bookingFormSchema = z.object({
  equipmentId: z.string().min(1, "Please select equipment"),
  startTime: z.string().min(1, "Please select a start time"),
  endTime: z.string().min(1, "Please select an end time"),
});
