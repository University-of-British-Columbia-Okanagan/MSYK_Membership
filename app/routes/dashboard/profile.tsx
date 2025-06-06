import { useLoaderData } from "react-router-dom";
import { getProfileDetails } from "../../models/profile.server";
import type { LoaderFunction } from "react-router-dom";
import Sidebar from "../../components/ui/Dashboard/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { UserProfileData } from "~/models/profile.server";
import { CreditCard, User, Calendar, Medal } from "lucide-react";
import { getRoleUser } from "~/utils/session.server";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";

export async function loader({ request }: Parameters<LoaderFunction>[0]) {
  const user = await getProfileDetails(request);
  const roleUser = await getRoleUser(request);
  return { user, roleUser };
}

export default function ProfilePage() {
  const { user, roleUser } = useLoaderData<{ user: UserProfileData; roleUser: { roleId: number; roleName: string; userId: number; }; }>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">User profile not found.</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-100">
        {isAdmin ? <AdminAppSidebar /> : <Sidebar />}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-600">Manage your account details and preferences</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-6 sm:p-8 bg-gradient-to-r from-yellow-500 to-yellow-600">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative">
                    <img
                      src={
                        user.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                      }
                      alt={`${user.name}'s profile`}
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-md object-cover"
                    />
                    <div className="absolute bottom-0 right-0 bg-green-500 border-2 border-white rounded-full w-6 h-6 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  </div>
                  <div className="text-center sm:text-left text-white">
                    <h2 className="text-2xl sm:text-3xl font-bold">{user.name}</h2>
                    <p className="text-yellow-100 mb-2">{user.email}</p>
                    <div className="inline-block bg-yellow-700 bg-opacity-30 px-3 py-1 rounded-full text-sm text-yellow-50">
                      {user.membershipTitle !== "None" ? user.membershipTitle : "Free Account"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Membership Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Medal className="h-5 w-5 text-yellow-500" />
                      <h3 className="text-lg font-semibold text-gray-900">Membership Details</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status</span>
                        <span className="font-medium text-gray-900">
                          {user.membershipTitle !== "None" ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Plan</span>
                        <span className="font-medium text-gray-900">{user.membershipTitle}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Type</span>
                        <span className="font-medium text-gray-900">{user.membershipType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-yellow-500" />
                      <h3 className="text-lg font-semibold text-gray-900">Payment Information</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {user.cardLast4 !== "N/A" ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Payment Method</span>
                            <div className="flex items-center">
                              <span className="font-medium text-gray-900">•••• {user.cardLast4}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Billing Date</span>
                            <span className="font-medium text-gray-900">
                              {user.nextBillingDate 
                                ? new Date(user.nextBillingDate).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  }) 
                                : "N/A"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4">
                          <p className="text-gray-500 mb-2 text-center">No payment method on file</p>
                          <p className="text-gray-500 mb-6 text-sm text-center">Add a payment method to enable automatic billing</p>
                        </div>
                      )}
                      <div className="pt-2">
                        <a 
                          href="/user/profile/paymentinformation" 
                          className="block w-full bg-yellow-500 hover:bg-yellow-600 text-white text-center py-2 px-4 rounded-md transition duration-200 font-medium"
                        >
                          {user.cardLast4 !== "N/A" ? "Update Payment Method" : "Add Payment Method"}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Activity */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* You could add recent activity items here */}
                  <p className="text-gray-500 text-center py-4">No recent activity to display</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}