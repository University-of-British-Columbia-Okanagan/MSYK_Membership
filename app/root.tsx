import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import "./app.css";

//TODO: you need to move the layout to its own component, and theun update the routes.tsx file to use the layout component (see React Router 7 tutorial)
export function Layout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex flex-col relative">
          {/* Header should stay on top */}
          <header className="border-b bg-white shadow-md relative z-50">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <img
                  // src="https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg"
                  src = "public\images\Makerspace Horizontal Text Logo Colour-01.avif"
                  alt="Makerspace YK"
                  className="h-12 w-auto"
                />
              </Link>

              <nav className="hidden md:flex items-center gap-8">
                {/* About Dropdown (Fix Applied) */}
                <div className="relative group">
                  <Link
                    to="/about"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    About
                  </Link>

                  {/* Dropdown: Ensuring it's visible when hovered */}
                  <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-300 shadow-lg rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 group-hover:flex flex-col">
                    <Link
                      to="/board"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Our Board
                    </Link>
                    <Link
                      to="/staff"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Our Staff
                    </Link>
                    <Link
                      to="/contact"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Contact
                    </Link>
                  </div>
                </div>

                <Link
                  to="/programming"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Programming
                </Link>
                <Link
                  to="/spaces"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Spaces & Services
                </Link>
                <Link
                  to="/get-involved"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
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
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Layout />;
}
