import {
  useLoaderData,
  useActionData,
  useNavigation,
  Form,
} from "react-router";
import { json, redirect } from "@remix-run/node";
import {
  getEquipmentSlotsWithStatus,
  bookEquipment,
  getEquipmentById,
} from "../../models/equipment.server";
import { getUser } from "../../utils/session.server";
import { Button } from "@/components/ui/button";
import EquipmentBookingGrid from "../../components/ui/Dashboard/equipmentbookinggrid";
import { useState } from "react";

// ✅ Import this!
import { createCheckoutSession } from "../../models/payment.server";

// Loader
export async function loader() {
  const equipmentWithSlots = await getEquipmentSlotsWithStatus();
  return json({ equipment: equipmentWithSlots });
}

// Action
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const user = await getUser(request);

  if (!user) {
    return json({ errors: { message: "User not authenticated." } }, { status: 401 });
  }

  const equipmentId = Number(formData.get("equipmentId"));
  const slotsRaw = formData.get("slots");

  if (!equipmentId || !slotsRaw) {
    return json({ errors: { message: "Missing equipment or slots." } }, { status: 400 });
  }

  let slots;
  try {
    slots = JSON.parse(slotsRaw.toString());
  } catch (err) {
    return json({ errors: { message: "Invalid slots format." } }, { status: 400 });
  }

  try {
    for (const entry of slots) {
      const [startTime, endTime] = entry.split("|");
      await bookEquipment(request, equipmentId, startTime, endTime);
    }

    const equipment = await getEquipmentById(equipmentId);
    const totalPrice = equipment?.price * slots.length;

    // ✅ Direct call to your Stripe session creator
    const fakeRequest = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId,
        userId: user.id,
        userEmail: user.email,
        price: totalPrice,
        slotCount: slots.length,
        slots,
      }),
    });

    const response = await createCheckoutSession(fakeRequest);
    const sessionRes = await response.json();

    if (sessionRes?.url) {
      return redirect(sessionRes.url);
    } else {
      return json({ errors: { message: "Payment session failed." } }, { status: 500 });
    }
  } catch (error: any) {
    return json({ errors: { message: error.message } }, { status: 400 });
  }
}

// Component
export default function EquipmentBookingForm() {
  const { equipment } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const selectedEquip = selectedEquipment
    ? equipment.find((equip: { id: number }) => equip.id === selectedEquipment)
    : null;

  const totalPrice =
    selectedEquip?.price && selectedSlots.length
      ? (selectedEquip.price * selectedSlots.length).toFixed(2)
      : null;

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

      <Form method="post">
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

        {selectedEquipment && (
          <>
            <label className="block text-gray-700 font-bold mt-4 mb-2">
              Select Time Slots
            </label>
            <EquipmentBookingGrid
              slotsByDay={selectedEquip?.slotsByDay || {}}
              onSelectSlots={setSelectedSlots}
            />
            {totalPrice && (
              <p className="mt-3 font-semibold text-gray-700">
                Total: ${totalPrice} ({selectedSlots.length} slots)
              </p>
            )}
          </>
        )}

        <input type="hidden" name="equipmentId" value={selectedEquipment ?? ""} />
        <input type="hidden" name="slots" value={JSON.stringify(selectedSlots)} />

        <Button
          type="submit"
          className="mt-4 w-full bg-yellow-500 text-white py-2 rounded-md"
          disabled={navigation.state === "submitting" || selectedSlots.length === 0}
        >
          {navigation.state === "submitting" ? "Booking..." : "Proceed to Payment"}
        </Button>
      </Form>
    </div>
  );
}
