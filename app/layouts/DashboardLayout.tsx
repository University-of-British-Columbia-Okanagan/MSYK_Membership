import { Outlet, Link } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 p-4">
        <h2 className="text-xl font-bold mb-4">Makerspace YK</h2>
        <nav className="flex flex-col gap-4">
          <Link to="/dashboard/workshops">Workshops</Link>
          <Link to="/dashboard/events">Events</Link>
          <Link to="/dashboard/membership">Membership Plans</Link>
          <Link to="/logout" className="text-red-500">Sign Out</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
}
