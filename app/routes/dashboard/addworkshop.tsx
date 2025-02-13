import React from "react";
import { redirect, useNavigation, useActionData } from "react-router";
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
import { format } from "date-fns";
import { addWorkshop } from "~/models/workshop.server";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  // Convert price and capacity safely
  const price = parseFloat(rawValues.price as string);
  const capacity = parseInt(rawValues.capacity as string, 10);

  const parsed = workshopFormSchema.safeParse({
    ...rawValues,
    price, // Pass the parsed number separately
    capacity,
  });

  console.log("hello");
  console.log(parsed);

  if (!parsed.success) {
    console.log(parsed.error.flatten().fieldErrors);
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Make sure done after success
  // Convert eventDate from string to Date object
//   const eventDate = new Date(rawValues.eventDate as string);
  // Format eventDate to "YYYY-MM-DD HH:MM:SS"
//   const formattedEventDate = format(eventDate, "yyyy-MM-dd HH:mm:ss");

//  console.log(formattedEventDate);

const eventDate= new Date(parsed.data.eventDate);

 try {
    await addWorkshop({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      eventDate, // Correctly formatted date
      location: parsed.data.location,
      capacity: parsed.data.capacity,
      status: parsed.data.status,
    });
  } catch (error) {
    console.error("Error adding workshop:", error);
    return { errors: { database: ["Failed to add workshop"] } };
  }

  return redirect("/dashboardlayout");
}

export default function AddWorkshop() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
    },
  });

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
                <FormLabel>
                  Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Workshop Name"
                    {...field}
                    className="w-full lg:w-[500px]"
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
                <FormLabel>
                  Description <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Workshop Description"
                    {...field}
                    className="w-full"
                    rows={5}
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
                <FormLabel>
                  Price <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Price"
                    {...field}
                    step="0.01"
                    className="w-full"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.price}</FormMessage>
              </FormItem>
            )}
          />

          {/* Event Date */}
          <FormField
            control={form.control}
            name="eventDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Event Date <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} className="w-full" />
                </FormControl>
                <FormMessage>{actionData?.errors?.eventDate?.join(" ")}</FormMessage>
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Location <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Workshop Location"
                    {...field}
                    className="w-full"
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
                <FormLabel>
                  Capacity <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Capacity"
                    {...field}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.capacity}</FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Status <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <select {...field} className="w-full border rounded-md p-2">
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </FormControl>
                <FormMessage>{actionData?.errors?.status}</FormMessage>
              </FormItem>
            )}
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
