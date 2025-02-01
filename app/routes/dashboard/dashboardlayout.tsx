import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist"; // Fixed import
import { SidebarProvider } from "@/components/ui/sidebar"; // Fixed import

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <WorkshopList />
          <Outlet /> {/* Loads the nested dashboard routes */}
        </main>
      </div>
    </SidebarProvider>
  );
}
