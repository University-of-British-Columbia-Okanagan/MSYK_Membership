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
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { getRoleUser } from "../../utils/session.server";
// import { checkSlotAvailability } from "../../models/equipment.server";

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
  const roleUser = await getRoleUser(request);

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

  const maxSlotsPerDay = await getAdminSetting(
    "max_number_equipment_slots_per_day",
    "4"
  );

  const maxSlotsPerWeek = await getAdminSetting(
    "max_number_equipment_slots_per_week",
    "14"
  );

  return json({
    equipment: equipmentWithSlots,
    roleLevel,
    visibleDays: parseInt(visibleDays, 10),
    level3Restrictions,
    level4Restrictions,
    equipmentId,
    plannedClosures,
    maxSlotsPerDay: parseInt(maxSlotsPerDay, 10),
    maxSlotsPerWeek: parseInt(maxSlotsPerWeek, 10),
    roleUser,
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
  const slotCount = Number(formData.get("slotCount"));
  const slotsDataKey = formData.get("slotsData");

  if (!equipmentId || !slotCount || !slotsDataKey) {
    return json(
      { errors: { message: "Missing equipment or slot data." } },
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

  // Create Stripe checkout session
  try {
    // const totalPrice = equipment?.price * slots.length;
    const totalPrice = equipment?.price * slotCount;
    const fakeRequest = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId,
        userId: user.id,
        userEmail: user.email,
        price: totalPrice,
        slotCount: slotCount,
        slotsDataKey: slotsDataKey.toString(),
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
    maxSlotsPerDay,
    maxSlotsPerWeek,
    roleUser,
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const navigate = useNavigate();
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

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-8 w-full">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(isAdmin ? "/dashboard/equipments" : "/dashboard/equipments")
                }
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                {isAdmin ? "Back to Equipments" : "Back to Equipments"}
              </Button>
            </div>
            <h1 className="text-2xl font-bold mb-6 text-center">
              Book Equipment
            </h1>

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
                      roleLevel === 3
                        ? { startHour: 9, endHour: 17 }
                        : undefined
                    }
                    visibleDays={visibleDays}
                    level3Restrictions={
                      roleLevel === 3 ? level3Restrictions : undefined
                    }
                    level4Restrictions={
                      roleLevel === 4 ? level4Restrictions : undefined
                    }
                    plannedClosures={
                      roleLevel === 3 ? plannedClosures : undefined
                    } // Add this prop
                    userRoleLevel={roleLevel}
                    maxSlotsPerDay={maxSlotsPerDay}
                    maxSlotsPerWeek={maxSlotsPerWeek}
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
                name="slotCount"
                value={selectedSlots.length}
              />
              <input
                type="hidden"
                name="slotsData"
                value={(() => {
                  // Store slots in sessionStorage with a unique key
                  const storageKey = `equipment_slots_${Date.now()}_${Math.random()}`;
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(
                      storageKey,
                      JSON.stringify(selectedSlots)
                    );
                  }
                  return storageKey;
                })()}
              />
              <div className="flex justify-center mt-4">
                <Button
                  type="submit"
                  className="bg-yellow-500 text-white px-8 py-3 rounded-md shadow hover:bg-yellow-600 transition min-w-[200px]"
                  disabled={
                    navigation.state === "submitting" ||
                    selectedSlots.length === 0
                  }
                >
                  {navigation.state === "submitting"
                    ? "Booking..."
                    : "Proceed to Payment"}
                </Button>
              </div>
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
