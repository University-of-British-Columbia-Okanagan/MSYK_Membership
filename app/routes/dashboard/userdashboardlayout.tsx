import React from "react";
import { Outlet, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();

  if (roleUser && roleUser.roleName.toLowerCase() === "admin") {
    return redirect("/dashboard/admin"); // Redirect admin to Admin Dashboard
  }

  return { workshops };
}

export default function UserDashboard() {
  const { workshops } = useLoaderData();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <WorkshopList workshops={workshops} isAdmin={false} />
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
