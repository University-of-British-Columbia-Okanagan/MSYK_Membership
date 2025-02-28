import { useLoaderData, useNavigate } from "react-router-dom";
import EquipmentList from "@/components/ui/Dashboard/equipmentlist";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import { Outlet } from "react-router";
import { getAvailableEquipment } from "@/models/equipment.server";
import { Button } from "@/components/ui/button";

export function loader() {
  return getAvailableEquipment();
}

export default function Equipments() {
  const equipments = useLoaderData();
  const navigate = useNavigate();

  console.log("Fetched Equipments:", equipments);

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Available Equipment</h1>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition"
              onClick={() => navigate("/dashboard/addequipment")}
            >
              + Add Equipment
            </Button>
          </div>

          {/* Equipment List */}
          <EquipmentList equipments={equipments} />

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
