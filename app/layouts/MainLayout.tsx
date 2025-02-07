import { Outlet, Link } from "react-router-dom";
import "./app.css";

const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Navigation Bar */}
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
            <Link to="/about" className="text-gray-600 hover:text-gray-900">
              About
            </Link>
            <Link to="/programming" className="text-gray-600 hover:text-gray-900">
              Programming
            </Link>
            <Link to="/spaces" className="text-gray-600 hover:text-gray-900">
              Spaces & Services
            </Link>
            <Link to="/get-involved" className="text-gray-600 hover:text-gray-900">
              Get Involved
            </Link>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
