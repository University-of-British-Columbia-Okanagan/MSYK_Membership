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

  return { workshops };
}

export default function UserDashboard() {
  const { workshops } = useLoaderData();

  // Get current date
  const now = new Date();

  // Filter workshops based on the `status` field
  const activeWorkshops = workshops.filter(
    (workshop) => workshop.status === "active"
  );
  const pastWorkshops = workshops.filter(
    (workshop) => workshop.status === "past"
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

          {/* Active Workshops Section */}
          <h2 className="text-xl font-semibold mt-6">Active Workshops</h2>
          {activeWorkshops.length > 0 ? (
            <WorkshopList workshops={activeWorkshops} isAdmin={false} />
          ) : (
            <p className="text-gray-600 mt-4">No active workshops available.</p>
          )}

          {/* Past Workshops Section */}
          <h2 className="text-xl font-semibold mt-8">Past Workshops</h2>
          {pastWorkshops.length > 0 ? (
            <WorkshopList
              workshops={pastWorkshops}
              isAdmin={false}
              isPast={true}
            />
          ) : (
            <p className="text-gray-600 mt-4">No past workshops available.</p>
          )}

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
