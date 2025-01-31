import { Outlet } from "react-router-dom";
import Navbar from "@/components/ui/Navbar"; // Import Navbar

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <Navbar />
      
      {/* Dynamic Page Content */}
      <Outlet />
    </div>
  );
}
