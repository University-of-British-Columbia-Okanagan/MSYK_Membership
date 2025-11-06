import { z } from "zod";

export const workshopFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number(),
    location: z.string().min(1, "Location is required"),
    capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
    type: z.enum(["workshop", "orientation"]),
    workshopImage: z.any().optional(),

    hasPriceVariations: z.boolean().optional().default(false),
    priceVariations: z
      .array(
        z.object({
          name: z.string().min(1, "Variation name is required"),
          price: z.coerce.number().min(0, "Price must be a positive number"),
          description: z.string().min(1, "Description is required"),
          capacity: z.coerce
            .number()
            .min(1, "Capacity is required and must be at least 1"),
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
      path: ["priceVariations"],
    }
  )
  .refine(
    (data) => {
      // Check for unique prices among variations only (base price is now disabled)
      if (
        data.hasPriceVariations &&
        data.priceVariations &&
        data.priceVariations.length > 0
      ) {
        const variationPrices = data.priceVariations.map((v) => v.price);
        const uniquePrices = new Set(variationPrices);
        return variationPrices.length === uniquePrices.size;
      }
      return true;
    },
    {
      message: "All pricing option prices must be unique.",
      path: ["priceVariations"],
    }
  )
  .refine(
    (data) => {
      // Check that variation capacities don't exceed total workshop capacity
      if (
        data.hasPriceVariations &&
        data.priceVariations &&
        data.priceVariations.length > 0
      ) {
        const invalidVariations = data.priceVariations.filter(
          (variation) => variation.capacity > data.capacity
        );
        return invalidVariations.length === 0;
      }
      return true;
    },
    {
      message: "Variation capacities cannot exceed the total workshop capacity",
      path: ["priceVariations"],
    }
  )
  .refine(
    (data) => {
      // Check that the sum of all variation capacities doesn't exceed total workshop capacity
      if (
        data.hasPriceVariations &&
        data.priceVariations &&
        data.priceVariations.length > 0
      ) {
        const totalVariationCapacity = data.priceVariations.reduce(
          (sum, variation) => sum + variation.capacity,
          0
        );
        return totalVariationCapacity <= data.capacity;
      }
      return true;
    },
    {
      message:
        "The sum of all pricing option capacities cannot exceed the total workshop capacity",
      path: ["priceVariations"],
    }
  )
  .refine(
    (data) => {
      // Only validate positive price if price variations are NOT enabled
      if (!data.hasPriceVariations) {
        return data.price >= 0;
      }
      // If price variations are enabled, price can be -1 (ignored)
      return true;
    },
    {
      message: "Price must be a positive number",
      path: ["price"],
    }
  );

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;
