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

// **Fetch all equipment and their slot status**
export async function loader() {
  const equipmentWithSlots = await getEquipmentSlotsWithStatus();
  return json({ equipment: equipmentWithSlots });
}

// **Handles form submission**
export async function action({ request }) {
  const formData = await request.formData();
  const userId = Number(formData.get("userId"));
  const slotId = Number(formData.get("slotId"));

  if (!userId || !slotId) {
    return json(
      { errors: { message: "Please select a slot." } },
      { status: 400 }
    );
  }

  try {
    await bookEquipment(userId, slotId);
    return json({ success: "Equipment booked successfully!" });
  } catch (error) {
    return json({ errors: { message: error.message } }, { status: 400 });
  }
}

// **Equipment Booking Form**
export default function EquipmentBookingForm() {
  const { equipment } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(
    null
  );
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
        <label className="block text-gray-700 font-bold mb-2">
          Select Equipment
        </label>
        <select
          name="equipmentId"
          className="w-full p-2 border rounded"
          value={selectedEquipment ?? ""}
          onChange={(e) => {
            setSelectedEquipment(Number(e.target.value));
            setSelectedSlot(null);
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
            <label className="block text-gray-700 font-bold mt-4 mb-2">
              Select a Slot
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableSlots.length > 0 ? (
                availableSlots.map((slot) => {
                  const isWorkshopBooked = slot.workshopName !== null; // Check if reserved for a workshop
                  const isBooked = slot.isBooked || isWorkshopBooked;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`p-2 text-center rounded border ${
                        isBooked
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : selectedSlot === slot.id
                          ? "bg-blue-500 text-white"
                          : "bg-white hover:bg-blue-100"
                      }`}
                      disabled={isBooked}
                      onClick={() => !isBooked && setSelectedSlot(slot.id)}
                    >
                      {new Date(slot.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}

                      {/* Show remark for workshop-booked slots */}
                      {isWorkshopBooked && (
                        <span className="block text-xs text-red-600">
                          Reserved for {slot.workshopName}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <span className="text-gray-500">No available slots</span>
              )}
            </div>
          </>
        )}

        {/* Hidden input to store slot ID */}
        <input type="hidden" name="slotId" value={selectedSlot ?? ""} />

        {/* Submit Button */}
        {/* Submit Button */}
        <Button
          type="submit"
          className="mt-4 w-full bg-yellow-500 text-white py-2 rounded-md"
          disabled={navigation.state === "submitting" || selectedSlot === null}
        >
          {navigation.state === "submitting" ? "Booking..." : "Book Equipment"}
        </Button>
      </Form>
    </div>
  );
}
