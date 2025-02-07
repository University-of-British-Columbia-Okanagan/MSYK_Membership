import WorkshopList from "@/components/ui/Dashboard/workshoplist"; // Fixed import
import { SidebarProvider } from "@/components/ui/sidebar"; // Fixed import
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import { Outlet } from "react-router";
export default function Workshops() {
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
