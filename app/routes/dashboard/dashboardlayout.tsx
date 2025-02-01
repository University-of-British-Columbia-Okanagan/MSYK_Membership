import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "~/components/ui/Dashboard/workshoplist";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 p-6 bg-gray-100">
        <WorkshopList />
        <Outlet /> {/* Loads the nested dashboard routes */}
      </main>
    </div>
  );
}
