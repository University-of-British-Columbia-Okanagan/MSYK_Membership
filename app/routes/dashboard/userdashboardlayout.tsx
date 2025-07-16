import React from "react";
import { Outlet, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "@/components/ui/Dashboard/guestsidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);

  // Authentication check - only allow signed-in users (admins or regular users)
  if (!roleUser) {
    throw redirect("/login");
  }

  const workshops = await getWorkshops();

  return { workshops, roleUser };
}

export default function UserDashboard() {
  const { workshops, roleUser } = useLoaderData();

  // Get current date
  const now = new Date();

  // Filter workshops based on the `status` field
  const activeWorkshops = workshops.filter(
    (workshop) => workshop.status === "active"
  );
  const pastWorkshops = workshops.filter(
    (workshop) => workshop.status === "past"
  );

  // Determine user role
  const isAdmin = roleUser && roleUser.roleName?.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isGuest ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

          {/* Active Workshops Section */}
          <h2 className="text-xl font-semibold mt-6">Active Workshops</h2>
          {activeWorkshops.length > 0 ? (
            <WorkshopList workshops={activeWorkshops} isAdmin={isAdmin} />
          ) : (
            <p className="text-gray-600 mt-4">No active workshops available.</p>
          )}

          {/* Past Workshops Section */}
          <h2 className="text-xl font-semibold mt-8">Past Workshops</h2>
          {pastWorkshops.length > 0 ? (
            <WorkshopList
              workshops={pastWorkshops}
              isAdmin={isAdmin}
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
