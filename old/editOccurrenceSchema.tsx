import { z } from "zod";

export const editOccurrenceSchema = z.object({
    startDate: z.coerce.date().refine(
        (date) => !isNaN(date.getTime()),
        { message: "Invalid start date" }
      ),
      endDate: z.coerce.date().refine(
        (date) => !isNaN(date.getTime()),
        { message: "Invalid end date" }
      ),
  });
  
  export type OccurrenceEditValues = z.infer<typeof editOccurrenceSchema>;
  