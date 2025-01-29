import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
} from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import "./app.css";

export function Layout() {
  const [isAboutDropdownOpen, setAboutDropdownOpen] = useState(false);
  const [isProgrammingDropdownOpen, setProgrammingDropdownOpen] =
    useState(false);
  const aboutDropdownRef = useRef<HTMLDivElement>(null);
  const programmingDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        aboutDropdownRef.current &&
        !aboutDropdownRef.current.contains(event.target as Node)
      ) {
        setTimeout(() => setAboutDropdownOpen(false), 100);
      }
      if (
        programmingDropdownRef.current &&
        !programmingDropdownRef.current.contains(event.target as Node)
      ) {
        setTimeout(() => setProgrammingDropdownOpen(false), 100);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
                  src="/images/Makerspace Horizontal Text Logo Colour-01.avif"
                  alt="Makerspace YK"
                  className="h-12 w-auto"
                />
              </Link>

              <nav className="hidden md:flex items-center gap-8">
                {/* About Dropdown */}
                <div className="relative" ref={aboutDropdownRef}>
                  <button
                    onClick={() => setAboutDropdownOpen((prev) => !prev)}
                    className="text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
                    aria-expanded={isAboutDropdownOpen}
                  >
                    About ▼
                  </button>

                  {/* Dropdown Menu */}
                  {isAboutDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-300 shadow-lg rounded-md">
                      <Link
                        to="/about"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setAboutDropdownOpen(false)}
                      >
                        About
                      </Link>
                      <Link
                        to="/board"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setAboutDropdownOpen(false)}
                      >
                        Our Board
                      </Link>
                      <Link
                        to="/staff"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setAboutDropdownOpen(false)}
                      >
                        Our Staff
                      </Link>
                      <Link
                        to="/contact"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setAboutDropdownOpen(false)}
                      >
                        Contact
                      </Link>
                    </div>
                  )}
                </div>

                {/* Programming Dropdown */}
                <div className="relative" ref={programmingDropdownRef}>
                  <button
                    onClick={() => setProgrammingDropdownOpen((prev) => !prev)}
                    className="text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
                    aria-expanded={isProgrammingDropdownOpen}
                  >
                    Programming ▼
                  </button>

                  {isProgrammingDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-300 shadow-lg rounded-md">
                      <Link
                        to="/workshopregistration"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Workshop Registration
                      </Link>
                      <Link
                        to="/eventcalendar"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Event Calendar
                      </Link>
                      <Link
                        to="/makertomarket"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Maker to Market
                      </Link>
                      <Link
                        to="/muralproject"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Mural Project
                      </Link>
                      <Link
                        to="/dontfakeit"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Don't Fake It
                      </Link>
                      <Link
                        to="/makermarket2024"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Maker Market 2024
                      </Link>
                      <Link
                        to="/pastworkshops"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setProgrammingDropdownOpen(false)}
                      >
                        Past Workshops
                      </Link>
                    </div>
                  )}
                </div>

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
