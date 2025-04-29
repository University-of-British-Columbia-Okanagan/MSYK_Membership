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
  const user = useLoaderData<UserProfileData>();

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
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
            {/* Avatar */}
            <div className="flex justify-center mb-4">
              <img
                src={
                  user.avatarUrl ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                }
                alt="User Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
              />
            </div>

            <h2 className="text-xl font-bold text-center mb-2">{user.name}</h2>

            <div className="text-center text-sm text-gray-700 space-y-1 mb-4">
              <p>
                <span className="font-semibold">Membership:</span>{" "}
                {user.membershipTitle || "None"}
              </p>
              <p>
                <span className="font-semibold">Type:</span>{" "}
                {user.membershipType || "N/A"}
              </p>
            </div>

            <div className="border-t my-4" />

            <div className="text-sm text-gray-700 space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="font-medium">Card:</span>
                <span>**** **** **** {user.cardLast4}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Next Billing:</span>
                <span>
                  {user.nextBillingDate
                    ? new Date(user.nextBillingDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <a
                href="/edit-profile"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Edit Profile
              </a>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
