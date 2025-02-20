import React from "react";
import { Outlet, Link, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getWorkshops, deleteWorkshop, duplicateWorkshop } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import { FiPlus } from "react-icons/fi";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user"); // Redirect non-admins to User Dashboard
  }

  return { roleUser, workshops };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const workshopId = formData.get("workshopId");

  if (action === "edit") {
    return redirect(`/editworkshop/${workshopId}`);
  }

  if (action === "delete") {
    try {
      await deleteWorkshop(Number(workshopId));
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error deleting workshop:", error);
      return { error: "Failed to delete workshop" };
    }
  }

  if (action === "duplicate") {
    try {
      await duplicateWorkshop(Number(workshopId));
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error duplicating workshop:", error);
      return { error: "Failed to duplicate workshop" };
    }
  }

  return null;
}

export default function AdminDashboard() {
  const { workshops } = useLoaderData();
  
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          {/* Move Add Workshop Button to the Right */}
          <div className="flex justify-end mb-6 pr-4"> {/* Added pr-4 for extra spacing */}
            <Link to="/addworkshop">
              <button className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                <FiPlus size={18} /> Add Workshop {/* Plus Icon */}
              </button>
            </Link>
          </div>

          {/* Display Workshop Cards */}
          <WorkshopList workshops={workshops} isAdmin={true} />
          
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}