import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

const Navbar = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isProgrammingDropdownOpen, setProgrammingDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const programmingDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (programmingDropdownRef.current && !programmingDropdownRef.current.contains(event.target as Node)) {
        setProgrammingDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="border-b bg-white shadow-md">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/images/Makerspace-Logo.avif"
            alt="Makerspace YK"
            className="h-12 w-auto"
          />
        </Link>

        {/* Navigation Menu */}
        <nav className="hidden md:flex items-center gap-8">
          {/* About Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
              aria-expanded={isDropdownOpen}
            >
              About ▼
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-300 shadow-lg rounded-md">
                <Link to="/about" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  About
                </Link>
                <Link to="/board" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Our Board
                </Link>
                <Link to="/staff" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Our Staff
                </Link>
                <Link to="/contact" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
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

            {/* Dropdown Menu */}
            {isProgrammingDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-300 shadow-lg rounded-md">
                <Link to="/workshopregistration" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Workshop Registration
                </Link>
                <Link to="/eventcalendar" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Event Calendar
                </Link>
                <Link to="/makertomarket" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Maker to Market Program
                </Link>
                <Link to="/muralproject" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Augment YK Mural Project
                </Link>
                <Link to="/dontfakeit" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Don't Fake It, Make It!
                </Link>
                <Link to="/makermarket2024" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Maker Market 2024
                </Link>
                <Link to="/pastworkshops" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                  Past Workshops
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* User Login Button */}
        <Button variant="secondary" className="gap-2">
          <User className="h-4 w-4" />
          User Login
        </Button>
      </div>
    </header>
  );
};

export default Navbar;
