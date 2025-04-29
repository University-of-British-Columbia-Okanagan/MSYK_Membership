import { useLoaderData } from "react-router-dom";
import { getProfileDetails } from "../../models/profile.server";
import type { LoaderFunction } from "@remix-run/node";
import Sidebar from "../../components/ui/Dashboard/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { UserProfileData } from "~/models/profile.server";

export async function loader({ request }: Parameters<LoaderFunction>[0]) {
  const user = await getProfileDetails(request);
  return { user };
}

export default function ProfilePage() {
    const { user } = useLoaderData<{ user: UserProfileData }>(); 

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">User profile not found.</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
  <div className="flex h-screen">
    <Sidebar />
    <main className="flex-1 p-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-md px-8 py-10">
        {/* Avatar + User Info */}
        <div className="flex items-center gap-5 mb-8">
          <img
            src={
              user.avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
            }
            alt="User Avatar"
            className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500"
          />
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>

        <hr className="mb-6" />

        {/* Membership Info */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-1">🎟 Membership Info</h3>
          <div className="text-sm text-gray-700 space-y-1 pl-1">
            <p>
              <span className="font-medium">Membership:</span>{" "}
              {user.membershipTitle || "None"}
            </p>
            <p>
              <span className="font-medium">Type:</span>{" "}
              {user.membershipType || "N/A"}
            </p>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-800 mb-1">💳 Payment Info</h3>
          <div className="text-sm text-gray-700 space-y-1 pl-1">
            <p>
              <span className="font-medium">Card:</span>{" "}
              **** **** **** {user.cardLast4 || "N/A"}
            </p>
            <p>
              <span className="font-medium">Next Billing:</span>{" "}
              {user.nextBillingDate
                ? new Date(user.nextBillingDate).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Edit Button */}
        <div className="text-center">
          <a
            href="/edit-profile"
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-6 py-2 rounded-md shadow-sm transition"
          >
            Edit Profile
          </a>
        </div>
      </div>
    </main>
  </div>
</SidebarProvider>
  );}