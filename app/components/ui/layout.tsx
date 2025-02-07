import { Outlet, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white shadow-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/images/Makerspace Horizontal Text Logo Colour-01.avif"
              alt="Makerspace YK"
              className="h-12 w-auto"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/about">About</Link>
            <Link to="/programming">Programming</Link>
            <Link to="/spaces">Spaces & Services</Link>
            <Link to="/get-involved">Get Involved</Link>
          </nav>

          <Button variant="secondary" className="gap-2">
            <User className="h-4 w-4" />
            User Login
          </Button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
