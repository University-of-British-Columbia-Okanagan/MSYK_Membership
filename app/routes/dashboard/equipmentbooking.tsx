import {
  useLoaderData,
  useActionData,
  useNavigation,
  Form,
} from "react-router";
import { json } from "@remix-run/node";
import {
  getEquipmentSlotsWithStatus,
  bookEquipment,
} from "../../models/equipment.server";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import EquipmentBookingGrid from "../../components/ui/Dashboard/equipmentbookinggrid";
import { getUserId } from "../../utils/session.server";

// **Fetch all equipment and their slot status**
export async function loader() {
  const equipmentWithSlots = await getEquipmentSlotsWithStatus(); // ✅ Fetches slot data
  return json({ equipment: equipmentWithSlots });
}

// **Handles form submission**
export async function action({ request }) {
  const formData = await request.formData();
  const userId = await getUserId(request);

  if (!userId) {
    return json({ errors: { message: "User not authenticated. Please log in." } }, { status: 401 });
  }

  const selectedEquipment = formData.get("equipmentId");
  if (!selectedEquipment || isNaN(Number(selectedEquipment))) {
    return json({ errors: { message: "Invalid equipment selection." } }, { status: 400 });
  }
  const equipmentId = Number(selectedEquipment); // Convert to number

  const slotsRaw = formData.get("slots");
  console.log("Raw Slots from FormData:", slotsRaw);

  if (!slotsRaw) {
    return json({ errors: { message: "No slots data received." } }, { status: 400 });
  }

  let slots;
  try {
    slots = JSON.parse(slotsRaw);
  } catch (err) {
    return json({ errors: { message: "Error parsing slots data." } }, { status: 400 });
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    return json({ errors: { message: "No slots selected." } }, { status: 400 });
  }

  try {
    for (const slotEntry of slots) {
      console.log("Processing slot entry:", slotEntry);
      
      if (typeof slotEntry !== "string" || !slotEntry.includes("|")) {
        return json({ errors: { message: `Invalid slot format: ${slotEntry}` } }, { status: 400 });
      }

      const [startTime, endTime] = slotEntry.split("|");

      console.log(`Booking Equipment: ${equipmentId}, Slot: ${startTime} - ${endTime}`);

      await bookEquipment(request, equipmentId, startTime, endTime);
    }
    return json({ success: "Equipment booked successfully!" });
  } catch (error) {
    return json({ errors: { message: error.message } }, { status: 400 });
  }
}



// **Equipment Booking Form
export default function EquipmentBookingForm() {
  const { equipment } = useLoaderData(); 
  const actionData = useActionData();
  const navigation = useNavigation();
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const selectedEquip = selectedEquipment
    ? equipment.find((equip: { id: number }) => equip.id === selectedEquipment)
    : null;

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
        {/* Equipment Selection */}
        <label className="block text-gray-700 font-bold mb-2">Select Equipment</label>
        <select
          className="w-full p-2 border rounded"
          value={selectedEquipment ?? ""}
          onChange={(e) => {
            setSelectedEquipment(Number(e.target.value));
            setSelectedSlots([]);
          }}
          required
        >
          <option value="">-- Select Equipment --</option>
          {equipment.map((equip: { id: number; name: string }) => (
            <option key={equip.id} value={equip.id}>
              {equip.name}
            </option>
          ))}
        </select>

        {/* Grid Selection */}
        {selectedEquipment && (
          <>
            <label className="block text-gray-700 font-bold mt-4 mb-2">Select Time Slots</label>
            <EquipmentBookingGrid slotsByDay={selectedEquip?.slotsByDay || {}} onSelectSlots={setSelectedSlots} />
          </>
        )}

        {/* Hidden input to store slot selections */}
        <input type="hidden" name="equipmentId" value={selectedEquipment ?? ""} />
        <input type="hidden" name="slots" value={JSON.stringify(selectedSlots)} />

        {/* Submit Button */}
        <Button
          type="submit"
          className="mt-4 w-full bg-yellow-500 text-white py-2 rounded-md"
          disabled={navigation.state === "submitting" || selectedSlots.length === 0}
        >
          {navigation.state === "submitting" ? "Booking..." : "Book Equipment"}
        </Button>
      </Form>
    </div>
  );
}
