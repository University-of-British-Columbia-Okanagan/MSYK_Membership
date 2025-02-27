import { useLoaderData } from "react-router-dom";
import EquipmentList from "@/components/ui/Dashboard/equipmentlist";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import { Outlet } from "react-router";
import { getAvailableEquipment } from "@/models/equipment.server";

export function loader() {
  return getAvailableEquipment(); // Fetch equipment data from the database
}

export default function Equipments() {
  const equipments = useLoaderData();
  console.log("Fetched Equipments:", equipments);

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <EquipmentList equipments={equipments} />
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
