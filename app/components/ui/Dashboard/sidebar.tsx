import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import {
  Home,
  Calendar,
  User,
  LogOut,
  ClipboardList,
  Package,
} from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppSidebar() {
  return (
    <Sidebar className="h-screen w-64 bg-white shadow-lg flex flex-col">
      {/* Sidebar Header with Logo */}
      <SidebarHeader className="flex justify-center p-4">
        <img
          src="/images/Makerspace Horizontal Text Logo Colour-01.avif"
          alt="Makerspace YK"
          className="h-30"
        />
      </SidebarHeader>

      {/* Sidebar Content - Navigation Links */}
      <SidebarContent className="flex flex-col gap-3 px-4 flex-grow space-y-4">
        <SidebarGroup className="space-y-10">
          <Link
            to="/profile"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <User className="w-5 h-5" />
            Profile
          </Link>
          <Link
            to="/workshops"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <ClipboardList className="w-5 h-5" />
            Workshops
          </Link>
          <Link
            to="/dashboard/events"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Calendar className="w-5 h-5" />
            Events
          </Link>
          <Link
            to="/dashboard/equipments"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Package className="w-5 h-5" />
            Equipments
          </Link>
          <Link
            to="/get-involved"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Home className="w-5 h-5" />
            Membership Plans
          </Link>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer - Sign Out Button */}
      <SidebarFooter className="p-4">
        <Separator className="mb-4" />
        <Button variant="secondary" className="flex items-center gap-2 w-full">
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
