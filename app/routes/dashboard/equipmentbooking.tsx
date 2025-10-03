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
import { logger } from "~/logging/logger";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/guestsidebar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { getRoleUser } from "../../utils/session.server";
import QuickCheckout from "~/components/ui/Dashboard/quickcheckout";
import { getSavedPaymentMethod } from "../../models/user.server";

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

  logger.info(
    `[User: ${
      userId ?? "guest"
    }] Loading equipment scheduler (equipmentId: ${equipmentId})`,
    { url: request.url }
  );

  let hasCompletedEquipmentPrerequisites = true;
  let equipmentPrerequisiteMessage = "";

  if (user && equipmentId && (roleLevel === 3 || roleLevel === 4)) {
    const { hasUserCompletedEquipmentPrerequisites } = await import(
      "../../models/equipment.server"
    );
    hasCompletedEquipmentPrerequisites =
      await hasUserCompletedEquipmentPrerequisites(user.id, equipmentId);

    if (!hasCompletedEquipmentPrerequisites) {
      equipmentPrerequisiteMessage =
        "You must complete the required prerequisite orientations before booking this equipment. Please check the equipment details page to see which orientations are required.";
    }
  }

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

  const savedPaymentMethod = user ? await getSavedPaymentMethod(user.id) : null;
  const gstPercentage = await getAdminSetting("gst_percentage", "5");

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
    savedPaymentMethod,
    hasCompletedEquipmentPrerequisites,
    equipmentPrerequisiteMessage,
    gstPercentage: parseFloat(gstPercentage),
  });
}

// Action
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const user = await getUser(request);
  const roleLevel = user?.roleLevel ?? 1;

  if (!user) {
    logger.warn(`[Guest] Attempt to book equipment without authentication`, {
      url: request.url,
    });
    return json(
      { errors: { message: "User not authenticated." } },
      { status: 401 }
    );
  }

  const equipmentId = Number(formData.get("equipmentId"));
  const slotCount = Number(formData.get("slotCount"));
  const slotsDataKey = formData.get("slotsData");

  if (!equipmentId || !slotCount || !slotsDataKey) {
    logger.warn(`[User: ${user.id}] Missing equipment or slot data`, {
      url: request.url,
    });
    return json(
      { errors: { message: "Missing equipment or slot data." } },
      { status: 400 }
    );
  }

  const equipment = await getEquipmentById(equipmentId);
  if (!equipment) {
    logger.warn(`[User: ${user.id}] Equipment ID ${equipmentId} not found`, {
      url: request.url,
    });
    throw new Response("Equipment Not Found", { status: 404 });
  }

  if (!equipment.availability) {
    logger.warn(
      `[User: ${user.id}] Equipment ID ${equipmentId} is not available`,
      { url: request.url }
    );
    throw new Response("Equipment Not Available", { status: 419 });
  }

  // Create Stripe checkout session
  try {
    // const totalPrice = equipment?.price * slots.length;
    const totalPrice = equipment?.price * slotCount;

    logger.info(
      `[User: ${user.id}] Initiating checkout session for equipment ID ${equipmentId} with ${slotCount} slots`,
      { url: request.url }
    );

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
    let sessionRes;
    if (response instanceof Response) {
      sessionRes = await response.json();
    } else {
      sessionRes = response;
    }

    if (sessionRes?.url) {
      logger.info(`[User: ${user.id}] Checkout session created successfully`, {
        url: request.url,
      });
      return redirect(sessionRes.url);
    } else {
      logger.error(
        `[User: ${user.id}] Failed to create checkout session - missing URL`,
        { url: request.url }
      );
      return json(
        { errors: { message: "Payment session failed." } },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error(
      `[User: ${user.id}] Error creating checkout session: ${error.message}`,
      { url: request.url }
    );
    return json({ errors: { message: error.message } }, { status: 400 });
  }
}

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
    savedPaymentMethod,
    hasCompletedEquipmentPrerequisites,
    equipmentPrerequisiteMessage,
    gstPercentage,
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
      <div className="absolute inset-0 flex">
        {!roleUser ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-8 w-full">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Book Equipment</h1>
            </div>

            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    isAdmin ? "/dashboard/equipments" : "/dashboard/equipments"
                  )
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
                  {/* Guest Authentication Section */}
                  {!roleUser && (
                    <div className="mt-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">
                          Account Required
                        </h3>
                        <p className="text-blue-700 mb-4">
                          You need an account to book equipment. Please sign in
                          or create an account to continue.
                        </p>
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={() => {
                              const currentUrl =
                                window.location.pathname +
                                window.location.search;
                              window.location.href = `/login?redirect=${encodeURIComponent(
                                currentUrl
                              )}`;
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                          >
                            Sign In
                          </button>
                          <button
                            onClick={() => {
                              const currentUrl =
                                window.location.pathname +
                                window.location.search;
                              window.location.href = `/register?redirect=${encodeURIComponent(
                                currentUrl
                              )}`;
                            }}
                            className="bg-white hover:bg-blue-50 text-blue-500 border border-blue-500 px-6 py-2 rounded-lg font-medium transition-colors"
                          >
                            Create Account
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="block text-gray-700 font-bold mt-4 mb-2">
                    Select Time Slots
                  </label>

                  <EquipmentBookingGrid
                    slotsByDay={selectedEquip?.slotsByDay || {}}
                    onSelectSlots={setSelectedSlots}
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
                    }
                    userRoleLevel={roleLevel}
                    maxSlotsPerDay={maxSlotsPerDay}
                    maxSlotsPerWeek={maxSlotsPerWeek}
                    disabled={
                      !roleUser ||
                      (roleLevel === 1 || roleLevel === 2) && roleUser.roleId !== 2 ||
                      (!hasCompletedEquipmentPrerequisites &&
                        (roleLevel === 3 || roleLevel === 4))
                    }
                    disabledMessage={
                      !roleUser
                        ? "You need an account to book equipment."
                        : (roleLevel === 1 || roleLevel === 2) && roleUser.roleId !== 2
                        ? "You do not have the required membership to book equipment."
                        : equipmentPrerequisiteMessage
                    }
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

              {/* Quick Checkout Section */}
              {selectedSlots.length > 0 &&
                savedPaymentMethod &&
                selectedEquipment &&
                totalPrice && (
                  <div className="mt-6">
                    <QuickCheckout
                      userId={roleUser?.userId || 0}
                      checkoutData={{
                        type: "equipment",
                        equipmentId: selectedEquipment,
                        slotCount: selectedSlots.length,
                        price: parseFloat(totalPrice),
                        slotsDataKey: (() => {
                          // Store slots in sessionStorage with a unique key for quick checkout
                          const storageKey = `equipment_slots_quick_${Date.now()}_${Math.random()}`;
                          if (typeof window !== "undefined") {
                            sessionStorage.setItem(
                              storageKey,
                              JSON.stringify(selectedSlots)
                            );
                          }
                          return storageKey;
                        })(),
                      }}
                      itemName={`${selectedEquip?.name} Booking`}
                      itemPrice={parseFloat(totalPrice)}
                      gstPercentage={gstPercentage}
                      savedCard={{
                        cardLast4: savedPaymentMethod.cardLast4,
                        cardExpiry: savedPaymentMethod.cardExpiry,
                      }}
                      onSuccess={() => {
                        console.log("Equipment payment successful!");
                      }}
                      onError={(error) => {
                        console.error("Equipment payment failed:", error);
                      }}
                    />

                    {/* Divider */}
                    <div className="my-6 flex items-center">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <div className="mx-4 text-gray-500 text-sm">OR</div>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>
                  </div>
                )}

              <div className="flex justify-center mt-4">
                <Button
                  type="submit"
                  className="bg-indigo-500 text-white px-8 py-3 rounded-md shadow hover:bg-indigo-600 transition min-w-[200px]"
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
