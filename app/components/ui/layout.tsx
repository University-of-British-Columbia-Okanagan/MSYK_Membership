import { Link, Outlet } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg"
              alt="Makerspace YK"
              className="h-12 w-auto"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/about" className="text-gray-600 hover:text-gray-900 transition-colors">
              About
            </Link>
            <Link to="/programming" className="text-gray-600 hover:text-gray-900 transition-colors">
              Programming
            </Link>
            <Link to="/spaces" className="text-gray-600 hover:text-gray-900 transition-colors">
              Spaces & Services
            </Link>
            <Link to="/get-involved" className="text-gray-600 hover:text-gray-900 transition-colors">
              Get Involved
            </Link>
          </nav>
          <Button variant="secondary" className="gap-2">
            <User className="h-4 w-4" />
            User Login
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
