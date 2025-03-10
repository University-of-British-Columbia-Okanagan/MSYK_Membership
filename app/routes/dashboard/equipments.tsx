import { useLoaderData, useNavigate } from "react-router-dom";
import EquipmentList from "@/components/ui/Dashboard/equipmentlist";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import { Outlet } from "react-router";
import { getAvailableEquipment } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server"; 
import { Button } from "@/components/ui/button";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";

export async function loader({ request }: { request: Request }) {
  const equipments = await getAvailableEquipment();
  const roleUser = await getRoleUser(request);

  return { equipments, roleUser }; 
}

export default function Equipments() {
  const { equipments, roleUser } = useLoaderData();
  const navigate = useNavigate();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Available Equipment</h1>

            {/* Show Add Equipment button only for Admins */}
            {roleUser?.roleName.toLowerCase() === "admin" && (
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition"
                onClick={() => navigate("/dashboard/addequipment")}
              >
                + Add Equipment
              </Button>
            )}
          </div>

          {/* Equipment List */}
          <EquipmentList equipments={equipments} />

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
