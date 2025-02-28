import React from "react";
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
import { equipmentFormSchema } from "../../schemas/equipmentFormSchema";
import type { EquipmentFormValues } from "../../schemas/equipmentFormSchema";
import { addEquipment } from "~/models/equipment.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const price = parseFloat(rawValues.price as string);
  const parsed = equipmentFormSchema.safeParse({
    ...rawValues,
    price,
  });

  if (!parsed.success) {
    console.log("Validation Errors:", parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await addEquipment({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      availability: parsed.data.availability === "true",
    });
  } catch (error) {
    console.error("Error adding equipment:", error);
    return { errors: { database: ["Failed to add equipment"] } };
  }

  return redirect("/dashboard/admin/equipments");
}

export default function AddEquipment() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();

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
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">Add Equipment</h1>

      {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post">
          {/* Equipment Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input id="name" placeholder="Equipment Name" {...field} className="w-full" autoComplete="off" />
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
                <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Textarea id="description" placeholder="Equipment Description" {...field} className="w-full" rows={4} autoComplete="off" />
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
                <FormLabel>Price <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input id="price" type="number" placeholder="Price" {...field} step="0.01" className="w-full" autoComplete="off" />
                </FormControl>
                <FormMessage>{actionData?.errors?.price}</FormMessage>
              </FormItem>
            )}
          />

          {/* Availability */}
          <FormField
            control={form.control}
            name="availability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Availability <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Select {...field}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Available</SelectItem>
                      <SelectItem value="false">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage>{actionData?.errors?.availability}</FormMessage>
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <Button type="submit" className="mt-6 w-full bg-blue-500 text-white px-4 py-2 rounded-md shadow hover:bg-blue-600 transition">
            Add Equipment
          </Button>
        </form>
      </Form>
    </div>
  );
}
