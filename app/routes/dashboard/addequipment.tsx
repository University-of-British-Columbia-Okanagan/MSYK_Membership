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
import { getAvailableEquipmentForAdmin, addEquipment, getEquipmentByName } from "~/models/equipment.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


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

  // Parse slots and auto-calculate `endTime` (30 minutes later)
  const slotsRaw = formData.getAll("slots");
  const slots =
    slotsRaw.length > 0
      ? slotsRaw.map((slot) => {
          try {
            const parsedSlot = JSON.parse(slot as string);
            const startTime = new Date(parsedSlot.startTime);
            return {
              startTime,
              endTime: new Date(startTime.getTime() + 30 * 60000), // Auto-add 30 minutes
              isBooked: false,
            };
          } catch (error) {
            console.error("Error parsing slot:", error);
            return null;
          }
        }).filter(Boolean)
      : [];

  console.log("Parsed Slots:", slots);

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

  
    const newEquipment = await addEquipment({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      availability: parsed.data.availability === "true",
      slots,
    });

    console.log("New Equipment Added:", newEquipment);

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

  const [slots, setSlots] = useState<{ startTime: string }[]>([]);

  const addSlot = () => {
    setSlots([...slots, { startTime: "" }]);
  };

  const removeSlot = (index: number) => {
    const updatedSlots = slots.filter((_, i) => i !== index);
    setSlots(updatedSlots);
  };

  const updateSlot = (index: number, key: string, value: string) => {
    const updatedSlots = [...slots];
    updatedSlots[index] = { ...updatedSlots[index], [key]: value };
    setSlots(updatedSlots);
  };


    return (
      <div className="max-w-4xl mx-auto p-8 bg-white shadow-md rounded-lg">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">Add Equipment</h1>
  
        {actionData?.errors && Object.keys(actionData.errors).length > 0 && (
          <div className="mb-6 text-sm text-red-500 bg-red-100 border border-red-400 rounded p-2">
            There are some errors in your form. Please review the highlighted fields below.
          </div>
        )}
  
        <Form {...form}>
          <form method="post" className="space-y-6">
            {/* Name & Price (Two Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Enter equipment name" {...field} className="w-full" />
                    </FormControl>
                  </FormItem>
                )}
              />
  
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter price" {...field} step="0.01" className="w-full" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
  
            {/* Description (Full Width) */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter equipment description" {...field} rows={4} className="w-full" />
                  </FormControl>
                </FormItem>
              )}
            />
  
            {/* Availability (Dropdown) */}
            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem className="w-full md:w-1/2">
                  <FormLabel>Availability <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Available</SelectItem>
                        <SelectItem value="false">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
  
            {/* Equipment Slots (Styled Like "Workshop Dates") */}
            <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 w-full">
              <h2 className="text-lg font-semibold mb-2">Equipment Slots</h2>
  
              {slots.length === 0 && (
                <p className="text-gray-500 text-sm">No slots added yet.</p>
              )}
  
              {slots.map((slot, index) => (
              <div key={index} className="flex space-x-4 mt-2">
                  <input
                    type="datetime-local"
                    value={slot.startTime}
                  onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                    className="border p-2 rounded w-full"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
  
              <Button
                type="button"
                onClick={addSlot}
                className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded-md"
              >
                + Add Slot
              </Button>
            </div>
  
          {/* Hidden input for slots */}
          {slots.map((slot, index) => (
            <input key={index} type="hidden" name="slots" value={JSON.stringify(slot)} />
          ))}

          {/* Submit Button */}
          <Button type="submit" className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-green-600 transition">
            Add Equipment
            </Button>
          </form>
        </Form>
      </div>
    );
  }