import { useLoaderData, useNavigate, useFetcher } from "react-router-dom";
import EquipmentList from "@/components/ui/Dashboard/equipmentlist";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { getAvailableEquipment } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server"; 
import { Button } from "@/components/ui/button";
import { deleteEquipment, duplicateEquipment, updateEquipment } from "~/models/equipment.server";

export async function loader({ request }: { request: Request }) {
  // Define default start and end time (or fetch dynamically if required)
  const startTime = new Date(); // Current time
  const endTime = new Date(); 
  endTime.setHours(endTime.getHours() + 24); 

  const equipments = await getAvailableEquipment(startTime, endTime);
  const roleUser = await getRoleUser(request);

  return { equipments, roleUser };
}


export default function Equipments() {
  const { equipments, roleUser } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <div className="flex justify-end items-center mb-6">
            {isAdmin && (
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition"
                onClick={() => navigate("/dashboard/addequipment")}
              >
                + Add Equipment
              </Button>
            )}
          </div>

          {/* Equipment List */}
          <EquipmentList equipments={equipments} isAdmin={isAdmin} />

          <fetcher.Form method="post">
            <input type="hidden" name="equipmentId" value="" />
            <input type="hidden" name="action" value="" />
          </fetcher.Form>
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