import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist"; // Fixed import
import { SidebarProvider } from "@/components/ui/sidebar"; // Fixed import
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/dashboardlayout";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();

  return { roleUser, workshops };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const { workshops } = loaderData; 

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <WorkshopList workshops={workshops} />
          <Outlet /> {/* Loads the nested dashboard routes */}
        </main>
      </div>
    </SidebarProvider>
  );
}
