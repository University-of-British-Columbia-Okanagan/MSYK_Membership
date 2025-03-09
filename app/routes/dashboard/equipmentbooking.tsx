import {
    useLoaderData,
    useActionData,
    useNavigation,
    Form,
  } from "react-router";
  import { json } from "@remix-run/node"; // Removed redirect
  import { getAvailableEquipment, bookEquipment , getAvailableSlots} from "../../models/equipment.server";
  import { useState } from "react";
  import { useForm, FormProvider } from "react-hook-form";
  import { zodResolver } from "@hookform/resolvers/zod";
  import { bookingFormSchema } from "../../schemas/bookingFormSchema";
  import { Input } from "@/components/ui/input";
  import { FormItem, FormLabel, FormMessage, FormField, FormControl } from "@/components/ui/form";
  import { Button } from "@/components/ui/button";
  
  // Fetch available equipment
  export async function loader() {
    const equipment = await getAvailableEquipment();
  
    // Fetch slots for each equipment
    const equipmentWithSlots = await Promise.all(
      equipment.map(async (equip) => ({
        ...equip,
        slots: await getAvailableSlots(equip.id),
      }))
    );
  
    return json({ equipment: equipmentWithSlots });
  }
  
  // Handles form submission
  export async function action({ request }) {
    const formData = await request.formData();
    const userId = Number(formData.get("userId"));
    const slotId = Number(formData.get("slotId"));
  
    if (!userId || !slotId) {
      return json({ errors: { message: "Please select a slot." } }, { status: 400 });
    }
  
    try {
      const booking = await bookEquipment(userId, slotId);
      return json({ success: "Equipment booked successfully!" });
    } catch (error) {
      return json({ errors: { message: error.message } }, { status: 400 });
    }
  }
  
  // Equipment Booking Form
  export default function EquipmentBookingForm() {
    const { equipment } = useLoaderData();
    const actionData = useActionData();
    const navigation = useNavigation();
    const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  
    const availableSlots = selectedEquipment
      ? equipment.find((equip) => equip.id === selectedEquipment)?.slots || []
      : [];
  
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Book Equipment</h1>
  
        {/* Success/Error Messages */}
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
  
        <Form method="post">
          <input type="hidden" name="userId" value="1" />
  
          {/* Equipment Selection */}
          <label className="block text-gray-700 font-bold mb-2">Select Equipment</label>
          <select
            name="equipmentId"
            className="w-full p-2 border rounded"
            value={selectedEquipment ?? ""}
            onChange={(e) => {
              setSelectedEquipment(Number(e.target.value));
              setSelectedSlot(null); // Reset slot selection when changing equipment
            }}
            required
          >
            <option value="">-- Select Equipment --</option>
            {equipment.map((equip) => (
              <option key={equip.id} value={equip.id}>
                {equip.name}
              </option>
            ))}
          </select>
  
          {/* Slot Selection */}
          {selectedEquipment && (
            <>
              <label className="block text-gray-700 font-bold mt-4 mb-2">Select a Slot</label>
              <select
                name="slotId"
                className="w-full p-2 border rounded"
                value={selectedSlot ?? ""}
                onChange={(e) => setSelectedSlot(Number(e.target.value))}
                required
              >
                <option value="">-- Select a Slot --</option>
                {availableSlots.length > 0 ? (
                  availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {new Date(slot.startTime).toLocaleString()}
                    </option>
                  ))
                ) : (
                  <option disabled>No available slots</option>
                )}
              </select>
            </>
          )}
  
          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-4 w-full bg-yellow-500 text-white py-2 rounded-md"
            disabled={navigation.state === "submitting"}
          >
            {navigation.state === "submitting" ? "Booking..." : "Book Equipment"}
          </Button>
        </Form>
      </div>
    );
  }