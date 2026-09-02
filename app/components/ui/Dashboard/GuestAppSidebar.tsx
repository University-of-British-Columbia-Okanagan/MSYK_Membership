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
  Package,
  LayoutDashboard,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function GuestAppSidebar() {
  return (
    <Sidebar className="h-screen w-64 bg-white shadow-lg flex flex-col">
      {/* Sidebar Header with Logo wrapped in Link */}
      <SidebarHeader className="flex justify-center p-4">
        <Link to="/dashboard">
          <img
            src="/images/Makerspace Horizontal Text Logo Colour-01.avif"
            alt="Makerspace YK"
            className="h-30"
          />
        </Link>
      </SidebarHeader>

      {/* Sidebar Content - Navigation Links */}
      <SidebarContent className="flex flex-col gap-3 px-4 flex-grow space-y-4">
        <SidebarGroup className="space-y-10">
          <Link
            to="/dashboard/workshops"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <LayoutDashboard className="w-5 h-5" />
            Workshops
          </Link>
          <Link
            to="/dashboard/events"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Calendar className="w-5 h-5" />
            Event Calendar
          </Link>
          <Link
            to="/dashboard/equipments"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Package className="w-5 h-5" />
            Equipment
          </Link>
          <Link
            to="/dashboard/memberships"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Home className="w-5 h-5" />
            Membership Plans
          </Link>
          <Link
            to="/dashboard/volunteer"
            className="flex items-center gap-2 text-gray-700 hover:text-blue-500"
          >
            <Heart className="w-5 h-5" />
            Volunteer
          </Link>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer - Sign In and Register Buttons */}
      <SidebarFooter className="p-4">
        <Separator className="mb-4" />
        <div className="space-y-2">
          <Link to="/login">
            <Button className="flex items-center gap-2 w-full bg-indigo-500 hover:bg-indigo-600 text-white">
              <LogOut className="w-5 h-5" />
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button
              variant="outline"
              className="flex items-center gap-2 w-full border-indigo-500 text-indigo-600 hover:bg-indigo-50"
            >
              <User className="w-5 h-5" />
              Register
            </Button>
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default GuestAppSidebar;
