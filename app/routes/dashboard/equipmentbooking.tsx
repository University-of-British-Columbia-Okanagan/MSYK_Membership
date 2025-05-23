import {
  useLoaderData,
  useActionData,
  useNavigation,
  Form,
} from "react-router";
import { json, redirect } from "@remix-run/node";
import {
  getEquipmentSlotsWithStatus,
  getEquipmentById,
  getLevel3ScheduleRestrictions,
  getLevel4UnavailableHours,
} from "../../models/equipment.server";
import { getUser } from "../../utils/session.server";
import { Button } from "@/components/ui/button";
import EquipmentBookingGrid from "../../components/ui/Dashboard/equipmentbookinggrid";
import { useState } from "react";
import { getAdminSetting, getPlannedClosures } from "../../models/admin.server";
import { createCheckoutSession } from "../../models/payment.server";
import { checkSlotAvailability } from "../../models/equipment.server";

// Loader
// export async function loader({ request }: { request: Request }) {
//   const user = await getUser(request);
//   const userId = user?.id ?? null;
//   const roleLevel = user?.roleLevel ?? 1;

//   const equipmentWithSlots = await getEquipmentSlotsWithStatus(userId ?? undefined);

//   return json({ equipment: equipmentWithSlots, roleLevel });
// }
export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id?: string };
}) {
  const user = await getUser(request);
  const userId = user?.id ?? null;
  const roleLevel = user?.roleLevel ?? 1;
  const equipmentId = params.id ? parseInt(params.id) : null;

  // Get the equipment_visible_registrable_days setting
  const equipmentWithSlots = await getEquipmentSlotsWithStatus(
    userId ?? undefined,
    true
  );
  const visibleDays = await getAdminSetting(
    "equipment_visible_registrable_days",
    "7"
  );

  // Get level-specific restrictions
  const level3Restrictions =
    roleLevel === 3 ? await getLevel3ScheduleRestrictions() : null;
  const level4Restrictions =
    roleLevel === 4 ? await getLevel4UnavailableHours() : null;

  const plannedClosures = roleLevel === 3 ? await getPlannedClosures() : [];

  return json({
    equipment: equipmentWithSlots,
    roleLevel,
    visibleDays: parseInt(visibleDays, 10),
    level3Restrictions,
    level4Restrictions,
    equipmentId,
    plannedClosures,
  });
}

// Action
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const user = await getUser(request);
  const roleLevel = user?.roleLevel ?? 1;

  if (!user) {
    return json(
      { errors: { message: "User not authenticated." } },
      { status: 401 }
    );
  }

  const equipmentId = Number(formData.get("equipmentId"));
  const slotsRaw = formData.get("slots");

  if (!equipmentId || !slotsRaw) {
    return json(
      { errors: { message: "Missing equipment or slots." } },
      { status: 400 }
    );
  }

  let slots;
  try {
    slots = JSON.parse(slotsRaw.toString());
  } catch (err) {
    return json(
      { errors: { message: "Invalid slots format." } },
      { status: 400 }
    );
  }

  const equipment = await getEquipmentById(equipmentId);
  if (!equipment) {
    throw new Response("Equipment Not Found", { status: 404 });
  }
  if (!equipment.availability) {
    throw new Response("Equipment Not Available", { status: 419 });
  }

  // REMOVED: The booking happens after payment now, not before
  // for (const entry of slots) {
  //   const [startTime, endTime] = entry.split("|");
  //   await bookEquipment(request, equipmentId, startTime, endTime);
  // }

  // Check if the selected slots are still available
  for (const entry of slots) {
    const [startTime, endTime] = entry.split("|");
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Check if the slot is already booked by someone else
    const isAvailable = await checkSlotAvailability(
      equipmentId,
      startDate,
      endDate
    );
    if (!isAvailable) {
      return json(
        {
          errors: {
            message:
              "One or more selected slots are no longer available. Please try again with different slots.",
          },
        },
        { status: 400 }
      );
    }
  }

  // Create Stripe checkout session
  try {
    const totalPrice = equipment?.price * slots.length;
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
      return json(
        { errors: { message: "Payment session failed." } },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return json({ errors: { message: error.message } }, { status: 400 });
  }
}

// Component
// export default function EquipmentBookingForm() {
//   const { equipment, roleLevel } = useLoaderData();
//   const actionData = useActionData();
//   const navigation = useNavigation();
//   const [selectedEquipment, setSelectedEquipment] = useState<number | null>(
//     null
//   );
//   const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
export default function EquipmentBookingForm() {
  const {
    equipment,
    roleLevel,
    visibleDays,
    level3Restrictions,
    level4Restrictions,
    equipmentId,
    plannedClosures,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(
    equipmentId
  );
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
        <label className="block text-gray-700 font-bold mb-2">
          Select Equipment
        </label>
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
            {/* <EquipmentBookingGrid
              slotsByDay={selectedEquip?.slotsByDay || {}}
              onSelectSlots={setSelectedSlots}
              disabled={roleLevel === 1 || roleLevel === 2}
              visibleTimeRange={
                roleLevel === 3 ? { startHour: 9, endHour: 18 } : undefined
              }
            /> */}
            {/* <EquipmentBookingGrid
              slotsByDay={selectedEquip?.slotsByDay || {}}
              onSelectSlots={setSelectedSlots}
              disabled={roleLevel === 1 || roleLevel === 2}
              visibleTimeRange={
                roleLevel === 3 ? { startHour: 9, endHour: 18 } : undefined
              }
              visibleDays={visibleDays} // Pass the number of visible days
            /> */}
            <EquipmentBookingGrid
              slotsByDay={selectedEquip?.slotsByDay || {}}
              onSelectSlots={setSelectedSlots}
              disabled={roleLevel === 1 || roleLevel === 2}
              visibleTimeRange={
                roleLevel === 3 ? { startHour: 9, endHour: 17 } : undefined
              }
              visibleDays={visibleDays}
              level3Restrictions={
                roleLevel === 3 ? level3Restrictions : undefined
              }
              level4Restrictions={
                roleLevel === 4 ? level4Restrictions : undefined
              }
              plannedClosures={roleLevel === 3 ? plannedClosures : undefined} // Add this prop
              userRoleLevel={roleLevel}
            />

            {totalPrice && (
              <p className="mt-3 font-semibold text-gray-700">
                Total: ${totalPrice} ({selectedSlots.length} slots)
              </p>
            )}
          </>
        )}

        <input
          type="hidden"
          name="equipmentId"
          value={selectedEquipment ?? ""}
        />
        <input
          type="hidden"
          name="slots"
          value={JSON.stringify(selectedSlots)}
        />

        <Button
          type="submit"
          className="mt-4 w-full bg-yellow-500 text-white py-2 rounded-md"
          disabled={
            navigation.state === "submitting" || selectedSlots.length === 0
          }
        >
          {navigation.state === "submitting"
            ? "Booking..."
            : "Proceed to Payment"}
        </Button>
      </Form>
    </div>
  );
}
