import React, { useState } from "react";
import { redirect, useActionData, useLoaderData } from "react-router";
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
import { equipmentFormSchema } from "../../schemas/equipmentFormSchema";
import type { EquipmentFormValues } from "../../schemas/equipmentFormSchema";
import {
  getAvailableEquipmentForAdmin,
  addEquipment,
  getEquipmentByName,
} from "~/models/equipment.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/**
 * Loader to fetch available equipment for admin.
 */
export async function loader() {
  const equipments = await getAvailableEquipmentForAdmin();
  return { equipments };
}

/**
 * Helper: Parse a datetime-local string as a local Date.
 */
function parseDateTimeAsLocal(value: string): Date {
  if (!value) return new Date("");
  return new Date(value);
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const price = parseFloat(rawValues.price as string);

  // Validate data
  const parsed = equipmentFormSchema.safeParse({
    ...rawValues,
    price,
  });

  if (!parsed.success) {
    console.log("Validation Errors:", parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    // Check if equipment name already exists
    const existingEquipment = await getEquipmentByName(parsed.data.name);
    if (existingEquipment) {
      return { errors: { name: ["Equipment with this name already exists."] } };
    }

    // Send only required fields to addEquipment
    const newEquipment = await addEquipment({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      availability: parsed.data.availability === "true" ? true : false,
    });

    console.log(" New Equipment Added:", newEquipment);

    return redirect("/dashboard/admin");
  } catch (error: any) {
    console.error("Error adding equipment:", error);

    if (error.code === "P2002") {
      return { errors: { name: ["Equipment name must be unique."] } };
    }

    return { errors: { database: ["Failed to add equipment"] } };
  }
}

export default function AddEquipment() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { equipments } = useLoaderData() as {
    equipments: { id: number; name: string }[];
  };

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      availability: "true",
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-md rounded-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">
        Add Equipment
      </h1>

      {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
        <div className="mb-6 text-sm text-red-500 bg-red-100 border border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post" className="space-y-6">
          {/* Name & Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      placeholder="Enter equipment name"
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder="Enter price"
                      {...field}
                      step="0.01"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
                    placeholder="Enter equipment description"
                    {...field}
                    rows={4}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Availability */}
          <FormField
            control={form.control}
            name="availability"
            render={({ field }) => (
              <FormItem className="w-full md:w-1/2">
                <FormLabel
                  htmlFor="availability"
                  className="flex items-center gap-1"
                >
                  Availability <span className="text-red-500">*</span>
                </FormLabel>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm text-muted-foreground cursor-help underline underline-offset-2">
                        What does this mean?
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      This equipment is available 24/7 for users unless the
                      admin sets it to unavailable.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    name={field.name}
                  >
                    <SelectTrigger id="availability" className="w-full">
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Available</SelectItem>
                      <SelectItem value="false">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-green-600 transition"
          >
            Add Equipment
          </Button>
        </form>
      </Form>
    </div>
  );
}
