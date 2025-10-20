import { useLoaderData, useNavigate, useFetcher } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { getRoleUser } from "~/utils/session.server";
import { Button } from "@/components/ui/button";
import {
  deleteEquipment,
  duplicateEquipment,
  updateEquipment,
  getAllEquipment,
} from "~/models/equipment.server";
import EquipmentCard from "~/components/ui/Dashboard/equipmentcard";
import GuestAppSidebar from "~/components/ui/Dashboard/guestsidebar";

export async function loader({ request }: { request: Request }) {
  const equipments = await getAllEquipment();
  const roleUser = await getRoleUser(request);

  return { equipments, roleUser };
}

export default function Equipments() {
  const { equipments, roleUser } = useLoaderData<{
    equipments: any[];
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    } | null;
  }>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {isGuest ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
        <main className="flex-grow p-6">
          {/* Mobile Header with Sidebar Trigger */}
          <div className="flex items-center gap-4 mb-6 md:hidden">
            <SidebarTrigger />
            <h1 className="text-xl font-bold">Equipment</h1>
          </div>

          <h1 className="text-2xl font-bold mb-6 hidden md:block">
            Available Equipment
          </h1>

          <div className="flex justify-end items-center mb-6">
            {isAdmin && (
              <Button
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md shadow transition"
                onClick={() => navigate("/dashboard/addequipment")}
              >
                + Add Equipment
              </Button>
            )}
          </div>

          {equipments.length > 0 ? (
            <div className="flex flex-wrap gap-4 md:gap-6 justify-start items-stretch">
              {equipments.map((equipment) => (
                <div key={equipment.id} className="w-full md:w-80 flex">
                  <EquipmentCard
                    id={equipment.id}
                    name={equipment.name}
                    description={equipment.description ?? ""}
                    imageUrl={equipment.imageUrl ?? ""}
                    status={equipment.status}
                    isAdmin={isAdmin}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 mt-4">No equipment available.</p>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const equipmentId = parseInt(formData.get("equipmentId") as string, 10);
  const actionType = formData.get("action");

  try {
    if (actionType === "delete") {
      await deleteEquipment(equipmentId);
      return { message: "Equipment deleted successfully." };
    } else if (actionType === "duplicate") {
      const newEquipment = await duplicateEquipment(equipmentId);
      return { message: `Equipment duplicated: ${newEquipment.name}` };
    } else if (actionType === "edit") {
      const updatedData = {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        availability: formData.get("availability") === "true",
      };
      await updateEquipment(equipmentId, updatedData);
      return { message: "Equipment updated successfully." };
    }
  } catch (error) {
    return { error: "Failed to process request." };
  }
}
