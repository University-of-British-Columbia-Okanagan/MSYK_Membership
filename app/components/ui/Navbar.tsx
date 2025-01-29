import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

const Navbar = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
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
            src="https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg"
            alt="Makerspace YK"
            className="h-12 w-auto"
          />
        </Link>

        {/* Navigation Menu */}
        <nav className="hidden md:flex items-center gap-8">
          {/* About Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Link
              to="/about"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
              aria-expanded={isDropdownOpen}
            >
              About ▼
            </Link>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className="absolute left-0 mt-2 w-48 bg-white border border-gray-300 shadow-lg rounded-md"
                onMouseEnter={() => setDropdownOpen(true)}
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <Link
                  to="/board"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => setDropdownOpen(false)}
                >
                  Our Board
                </Link>
                <Link
                  to="/staff"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => setDropdownOpen(false)}
                >
                  Our Staff
                </Link>
                <Link
                  to="/contact"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => setDropdownOpen(false)}
                >
                  Contact
                </Link>
              </div>
            )}
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
