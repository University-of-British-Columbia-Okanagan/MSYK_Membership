import { z } from "zod";

export const workshopFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    price: z.number().min(0, "Price must be a positive number"),
    location: z.string().min(1, "Location is required"),
    capacity: z.number().int().min(1, "Capacity must be at least 1"),
    type: z.enum(["workshop", "orientation"]),

    hasPriceVariations: z.boolean().optional().default(false),
    priceVariations: z
      .array(
        z.object({
          name: z.string().min(1, "Variation name is required"),
          price: z.number().min(0, "Price must be a positive number"),
          description: z.string().optional().default(""),
        })
      )
      .optional()
      .default([])
      .refine(
        (variations) => {
          // Check for duplicate variation names
          const names = variations.map((v) => v.name.toLowerCase().trim());
          return names.length === new Set(names).size;
        },
        {
          message: "Variation names must be unique",
        }
      ),

    occurrences: z
      .array(
        z.object({
          id: z.number().optional(),
          status: z.string().optional(),
          userCount: z.number().optional(),

          startDate: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
            message: "Invalid start date format",
          }),
          endDate: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
            message: "Invalid end date format",
          }),
          startDatePST: z.coerce.date().optional(),
          endDatePST: z.coerce.date().optional(),
        })
      )
      .min(1, "At least one occurrence is required")
      .refine(
        (occurrences) =>
          occurrences.every(
            (occ) => occ.endDate.getTime() > occ.startDate.getTime()
          ),
        {
          message: "End date must be later than start date",
          path: ["occurrences"],
        }
      ),
    prerequisites: z.array(z.number()).optional(),
    equipments: z.array(z.number()).optional(),
    isMultiDayWorkshop: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      // If price variations are enabled, there must be at least one variation
      if (
        data.hasPriceVariations &&
        (!data.priceVariations || data.priceVariations.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "At least one price variation is required when price variations are enabled",
      path: ["priceVariations"], // This will show the error on the priceVariations field
    }
  );

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;
