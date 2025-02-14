import React from "react";
import { Outlet, Link, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getWorkshops, deleteWorkshop } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";

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

  return null;
}

export default function AdminDashboard() {
  const { workshops } = useLoaderData();
  
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <WorkshopList workshops={workshops} isAdmin={true} />
          <div className="flex justify-start mb-6">
            <Link to="/addworkshop">
              <button className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                Add Workshop
              </button>
            </Link>
          </div>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
