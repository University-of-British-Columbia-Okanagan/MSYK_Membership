import { Link } from "react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import GuestSidebar from "~/components/ui/Dashboard/guestsidebar";
import {
  Users,
  Calendar,
  Wrench,
  CreditCard,
  ArrowRight,
  Star,
  Clock,
  Shield,
} from "lucide-react";

export default function DashboardLayout() {
  const features = [
    {
      icon: Users,
      title: "Workshops",
      description: "Explore hands-on learning experiences",
      link: "/dashboard/workshops",
      color: "bg-blue-500",
    },
    {
      icon: Calendar,
      title: "Events",
      description: "Discover upcoming community events",
      link: "/dashboard/events",
      color: "bg-green-500",
    },
    {
      icon: Wrench,
      title: "Equipment",
      description: "Browse our state-of-the-art tools",
      link: "/dashboard/equipments",
      color: "bg-purple-500",
    },
    {
      icon: CreditCard,
      title: "Membership Plans",
      description: "Find the perfect plan for you",
      link: "/dashboard/memberships",
      color: "bg-orange-500",
    },
  ];

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex bg-gray-50">
        <GuestSidebar />

        <main className="flex-1 overflow-auto">
          <div className="p-8">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Guest Dashboard</h1>
            </div>

            {/* Hero Section */}
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl p-8 mb-8 text-white">
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">
                  Welcome to Makerspace YK
                </h1>
                <strong>
                  {" "}
                  <p className="text-xl text-gray-600 opacity-90">
                    You're browsing as a guest
                  </p>{" "}
                </strong>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-lg mb-4 opacity-90">
                    Discover our workshops, events, equipment, and membership
                    options. Join our community of makers, creators, and
                    innovators!
                  </p>
                </div>

                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Guest Access Includes:
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Browse all workshops and events
                    </li>
                    <li className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      View equipments
                    </li>
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Compare membership plans
                    </li>
                    <li className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Limited booking access
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {features.map((feature) => (
                <Link
                  key={feature.title}
                  to={feature.link}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200 hover:border-indigo-300 group"
                >
                  <div
                    className={`${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-indigo-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {feature.description}
                  </p>
                  <div className="flex items-center text-indigo-600 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Explore</span>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Call to Action */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Ready to Get Started?
                </h2>
                <p className="text-gray-600 mb-6">
                  Create an account to book workshops, reserve equipment, and
                  become part of our maker community. Or sign in if you already
                  have an account.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/register"
                    className="bg-indigo-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Create Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
