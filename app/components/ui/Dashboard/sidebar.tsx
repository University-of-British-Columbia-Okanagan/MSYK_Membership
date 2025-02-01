import React from "react";
import { Link } from "react-router-dom";
import { Home, Calendar, User, LogOut, ClipboardList } from "lucide-react";

export default function AppSidebar() {
  return (
    <div className="h-screen w-64 bg-white shadow-lg flex flex-col p-4">
      <h2 className="text-xl font-bold mb-6">Makerspace YK</h2>
      <nav className="flex flex-col gap-4">
        <Link to="/profile" className="flex items-center gap-2 text-gray-700 hover:text-blue-500">
          <User className="w-5 h-5" />
          Profile
        </Link>
        <Link to="/workshops" className="flex items-center gap-2 text-gray-700 hover:text-blue-500">
          <ClipboardList className="w-5 h-5" />
          Workshops
        </Link>
        <Link to="/events" className="flex items-center gap-2 text-gray-700 hover:text-blue-500">
          <Calendar className="w-5 h-5" />
          Events
        </Link>
        <Link to="/membership" className="flex items-center gap-2 text-gray-700 hover:text-blue-500">
          <Home className="w-5 h-5" />
          Membership Plans
        </Link>
        <button className="flex items-center gap-2 text-red-500 hover:text-red-700 mt-auto">
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </nav>
    </div>
  );
}
