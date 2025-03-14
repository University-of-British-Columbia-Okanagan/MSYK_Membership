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

          {/* Equipment Slots */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold">Equipment Slots</h2>
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
            <button
              type="button"
              onClick={addSlot}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md"
            >
              + Add Slot
            </button>
          </div>

          {/* Hidden input for slots */}
          {slots.map((slot, index) => (
            <input key={index} type="hidden" name="slots" value={JSON.stringify(slot)} />
          ))}

          {/* Submit Button */}
          <Button type="submit" className="mt-6 w-full bg-green-500 text-white px-4 py-2 rounded-md shadow hover:bg-green-600 transition">
            Add Equipment
          </Button>
        </form>
      </Form>
    </div>
  );
}
