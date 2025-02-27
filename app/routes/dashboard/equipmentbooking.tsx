import {
    useLoaderData,
    useActionData,
    useNavigation,
    Form,
  } from "react-router";
  import { json } from "@remix-run/node"; // Removed redirect
  import { getAvailableEquipment, bookEquipment } from "../../models/equipment.server";
  import { useState } from "react";
  import { useForm, FormProvider } from "react-hook-form";
  import { zodResolver } from "@hookform/resolvers/zod";
  import { bookingFormSchema } from "../../schemas/bookingFormSchema";
  import { Input } from "@/components/ui/input";
  import { FormItem, FormLabel, FormMessage, FormField, FormControl } from "@/components/ui/form";
  import { Button } from "@/components/ui/button";
  
  // Fetch available equipment
  export async function loader() {
    return json({ equipment: await getAvailableEquipment() });
  }
  
  // Handles form submission
  export async function action({ request }) {
    const formData = await request.formData();
    const userId = Number(formData.get("userId"));
    const equipmentId = Number(formData.get("equipmentId"));
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
  
    if (!userId || !equipmentId || !startTime || !endTime) {
      return json({ errors: { message: "All fields are required." } }, { status: 400 });
    }
  
    try {
      const booking = await bookEquipment(userId, equipmentId, startTime, endTime);
      return json({ success: `You have booked the equipment from ${startTime} to ${endTime}.` });
    } catch (error) {
      console.error(error);
      return json({ errors: { message: error.message } }, { status: 400 });
    }
  }
  
  // Equipment Booking Form
  export default function EquipmentBookingForm() {
    const { equipment } = useLoaderData();
    const actionData = useActionData(); 
    const navigation = useNavigation();
  
    const formMethods = useForm({
      resolver: zodResolver(bookingFormSchema),
      defaultValues: {
        equipmentId: "",
        startTime: "",
        endTime: "",
      },
    });
  
 
    const [bookingConfirmed, setBookingConfirmed] = useState(false);
  
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Book Equipment</h1>
  
     
        {actionData?.success && (
          <div className="mb-4 text-green-600 bg-green-100 p-3 rounded border border-green-400">
            {actionData.success}
          </div>
        )}
  
    
        {actionData?.errors && (
          <div className="mb-4 text-red-500 bg-red-100 p-3 rounded border border-red-400">
            {actionData.errors.message}
          </div>
        )}
  
        <FormProvider {...formMethods}>
          <Form {...formMethods}>
            <form method="post" onSubmit={() => setBookingConfirmed(true)}>
              <input type="hidden" name="userId" value="1" />
  
              {/* Equipment Selection */}
              <FormField
                control={formMethods.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Equipment</FormLabel>
                    <FormControl>
                      <select {...field} className="w-full p-2 border rounded">
                        <option value="">-- Select --</option>
                        {equipment.map((equip) => (
                          <option key={equip.id} value={equip.id}>
                            {equip.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage>{actionData?.errors?.equipmentId}</FormMessage>
                  </FormItem>
                )}
              />
  
              {/* Start Time */}
              <FormField
                control={formMethods.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} className="w-full p-2 border rounded" />
                    </FormControl>
                    <FormMessage>{actionData?.errors?.startTime}</FormMessage>
                  </FormItem>
                )}
              />
  
              {/* End Time */}
              <FormField
                control={formMethods.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} className="w-full p-2 border rounded" />
                    </FormControl>
                    <FormMessage>{actionData?.errors?.endTime}</FormMessage>
                  </FormItem>
                )}
              />
  
              {/* Submit Button */}
              <Button
                type="submit"
                className="mt-4 w-full bg-yellow-500 text-white py-2 rounded-md"
                disabled={navigation.state === "submitting"}
              >
                {navigation.state === "submitting" ? "Booking..." : "Book Equipment"}
              </Button>
            </form>
          </Form>
        </FormProvider>
  

        {bookingConfirmed && actionData?.success && (
          <p className="mt-4 text-green-600 text-center font-bold">
            {actionData.success}
          </p>
        )}
      </div>
    );
  }
  