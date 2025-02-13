import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist"; // Fixed import
import { SidebarProvider } from "@/components/ui/sidebar"; // Fixed import
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/dashboardlayout";
import { NavLink, Link, redirect } from "react-router";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();

  return { roleUser, workshops };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { workshops, roleUser } = loaderData;
  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <WorkshopList workshops={workshops} />
          <div className="flex justify-start mb-6">
          {isAdmin && (
            <Link to="/addworkshop">
              <button className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                Add
              </button>
            </Link>
          )}
          </div>
          
          <Outlet /> {/* Loads the nested dashboard routes */}
        </main>
      </div>
    </SidebarProvider>
  );
}
