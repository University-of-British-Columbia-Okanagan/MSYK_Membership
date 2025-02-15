import React, { useState } from "react";
import { redirect, useActionData } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workshopFormSchema } from "../../schemas/workshopFormSchema";
import type { WorkshopFormValues } from "../../schemas/workshopFormSchema";
import { addWorkshop } from "~/models/workshop.server";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);

  // Get occurrences from hidden input field
  let occurrences: { startDate: Date; endDate: Date }[] = [];

  try {
    occurrences = JSON.parse(rawValues.occurrences as string).map(
      (occ: { startDate: string; endDate: string }) => {
        const startDate = new Date(occ.startDate);
        const endDate = new Date(occ.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error("Invalid date format");
        }

        return { startDate, endDate };
      }
    );
  } catch (error) {
    console.error("Error parsing occurrences:", error);
    return { errors: { occurrences: ["Invalid date format"] } };
  }

  console.log("Parsed occurrences:", occurrences);

  const parsed = workshopFormSchema.safeParse({
    ...rawValues,
    price,
    capacity,
    occurrences,
  });

  if (!parsed.success) {
    console.log("Validation Errors:", parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await addWorkshop({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      location: parsed.data.location,
      capacity: parsed.data.capacity,
      type: parsed.data.type,
      occurrences: parsed.data.occurrences,
    });
  } catch (error) {
    console.error("Error adding workshop:", error);
    return { errors: { database: ["Failed to add workshop"] } };
  }

  return redirect("/dashboard/admin");
}

export default function AddWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      location: "",
      capacity: 0,
      type: "workshop",
      occurrences: [],
    },
  });

  // Manage occurrences dynamically
  const [occurrences, setOccurrences] = useState<
    { startDate: string; endDate: string }[]
  >([]);

  const addOccurrence = () => {
    setOccurrences([...occurrences, { startDate: "", endDate: "" }]);
  };

  const updateOccurrence = (
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) => {
    const updatedOccurrences = [...occurrences];
    updatedOccurrences[index][field] = value;
    setOccurrences(updatedOccurrences);
  };

  const removeOccurrence = (index: number) => {
    setOccurrences(occurrences.filter((_, i) => i !== index));
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">Add Workshop</h1>

      {hasErrors && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="name"
                    placeholder="Workshop Name"
                    {...field}
                    className="w-full lg:w-[500px]"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.name}</FormMessage>
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    id="description"
                    placeholder="Workshop Description"
                    {...field}
                    className="w-full"
                    rows={5}
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.description}</FormMessage>
              </FormItem>
            )}
          />

          {/* Price */}
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="price">
                  Price <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="price"
                    type="number"
                    placeholder="Price"
                    {...field}
                    step="0.01"
                    className="w-full"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.price}</FormMessage>
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="location">
                  Location <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="location"
                    placeholder="Workshop Location"
                    {...field}
                    className="w-full"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.location}</FormMessage>
              </FormItem>
            )}
          />

          {/* Capacity */}
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="capacity">
                  Capacity <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="Capacity"
                    {...field}
                    className="w-full"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.capacity}</FormMessage>
              </FormItem>
            )}
          />

          {/* Workshop Occurrences (Date Selection) */}
          <div className="mt-4">
            <FormLabel>Workshop Occurrences</FormLabel>
            {occurrences.map((occ, index) => (
              <div key={index} className="flex gap-2 items-center mb-2">
                <Input
                  type="datetime-local"
                  value={occ.startDate}
                  onChange={(e) =>
                    updateOccurrence(index, "startDate", e.target.value)
                  }
                />
                <Input
                  type="datetime-local"
                  value={occ.endDate}
                  onChange={(e) =>
                    updateOccurrence(index, "endDate", e.target.value)
                  }
                />
                <Button
                  type="button"
                  onClick={() => removeOccurrence(index)}
                  className="bg-red-500 text-white"
                >
                  X
                </Button>
              </div>
            ))}
            <Button
              type="button"
              onClick={addOccurrence}
              className="mt-2 bg-blue-500 text-white"
            >
              + Add Date
            </Button>
          </div>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="type">
                  Workshop Type <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <select
                    id="type"
                    {...field}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="workshop">Workshop</option>
                    <option value="orientation">Orientation</option>
                  </select>
                </FormControl>
                <FormMessage>{actionData?.errors?.type}</FormMessage>
              </FormItem>
            )}
          />

          {/* Hidden Input for Occurrences */}
          <input
            type="hidden"
            name="occurrences"
            value={JSON.stringify(occurrences)}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
          >
            Submit
          </Button>
        </form>
      </Form>
    </div>
  );
}
