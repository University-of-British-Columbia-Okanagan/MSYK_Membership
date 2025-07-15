import { useLoaderData, Form } from "react-router-dom";
import {
  getProfileDetails,
  checkActiveVolunteerStatus,
  getVolunteerHours,
} from "../../models/profile.server";
import type { LoaderFunction } from "react-router-dom";
import Sidebar from "../../components/ui/Dashboard/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { UserProfileData } from "~/models/profile.server";
import { CreditCard, User, Calendar, Medal, Clock, Plus } from "lucide-react";
import { getRoleUser } from "~/utils/session.server";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "@/components/ui/Dashboard/guestsidebar";
import type { VolunteerHourEntry } from "../../models/profile.server";

export async function loader({ request }: Parameters<LoaderFunction>[0]) {
  const user = await getProfileDetails(request);
  const roleUser = await getRoleUser(request);

  // Check if user is an active volunteer and get their hours
  let isActiveVolunteer = false;
  let volunteerHours: VolunteerHourEntry[] = [];

  if (roleUser?.userId) {
    isActiveVolunteer = await checkActiveVolunteerStatus(roleUser.userId);

    if (isActiveVolunteer) {
      volunteerHours = await getVolunteerHours(roleUser.userId, 10);
    }
  }

  return { user, roleUser, isActiveVolunteer, volunteerHours };
}

export default function ProfilePage() {
  const { user, roleUser, isActiveVolunteer, volunteerHours } = useLoaderData<{
    user: UserProfileData;
    roleUser: { roleId: number; roleName: string; userId: number };
    isActiveVolunteer: boolean;
    volunteerHours: VolunteerHourEntry[];
  }>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  const renderSidebar = () => {
    if (isAdmin) {
      return <AdminAppSidebar />;
    } else if (isGuest) {
      return <GuestAppSidebar />;
    } else {
      return <Sidebar />;
    }
  };

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
        {renderSidebar()}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-600">
                Manage your account details and preferences
              </p>
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
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      {user.name}
                    </h2>
                    <p className="text-yellow-100 mb-2">{user.email}</p>
                    <div className="inline-block bg-yellow-700 bg-opacity-30 px-3 py-1 rounded-full text-sm text-yellow-50">
                      {user.membershipTitle !== "None"
                        ? user.membershipTitle
                        : "Free Account"}
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
                      <h3 className="text-lg font-semibold text-gray-900">
                        Membership Details
                      </h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status</span>
                        <span className="font-medium text-gray-900">
                          {user.membershipTitle !== "None"
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Plan</span>
                        <span className="font-medium text-gray-900">
                          {user.membershipTitle}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Type</span>
                        <span className="font-medium text-gray-900">
                          {user.membershipType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-yellow-500" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Payment Information
                      </h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {user.cardLast4 !== "N/A" ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              Payment Method
                            </span>
                            <div className="flex items-center">
                              <span className="font-medium text-gray-900">
                                •••• {user.cardLast4}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Billing Date</span>
                            <span className="font-medium text-gray-900">
                              {user.nextBillingDate
                                ? new Date(
                                    user.nextBillingDate
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4">
                          <p className="text-gray-500 mb-2 text-center">
                            No payment method on file
                          </p>
                          <p className="text-gray-500 mb-6 text-sm text-center">
                            Add a payment method to enable automatic billing
                          </p>
                        </div>
                      )}
                      <div className="pt-2">
                        <a
                          href="/user/profile/paymentinformation"
                          className="block w-full bg-yellow-500 hover:bg-yellow-600 text-white text-center py-2 px-4 rounded-md transition duration-200 font-medium"
                        >
                          {user.cardLast4 !== "N/A"
                            ? "Update Payment Method"
                            : "Add Payment Method"}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Activity */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent Activity
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* You could add recent activity items here */}
                  <p className="text-gray-500 text-center py-4">
                    No recent activity to display
                  </p>
                </div>
              </div>
            </div>

            {/* Volunteer Hours Section - Only show for active volunteers */}
            {isActiveVolunteer && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Volunteer Hours
                    </h3>
                  </div>
                </div>
                <div className="p-6">
                  {/* Add Hours Form */}
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <h4 className="font-medium text-blue-900 mb-4">
                      Log New Hours
                    </h4>
                    <Form
                      method="post"
                      className="grid grid-cols-1 md:grid-cols-4 gap-4"
                    >
                      <input type="hidden" name="_action" value="logHours" />

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Time
                        </label>
                        <input
                          type="datetime-local"
                          name="startTime"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Time
                        </label>
                        <input
                          type="datetime-local"
                          name="endTime"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <input
                          type="text"
                          name="description"
                          placeholder="What did you work on?"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center justify-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Log Hours
                        </button>
                      </div>
                    </Form>
                  </div>

                  {/* Recent Hours */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">
                      Recent Hours
                    </h4>
                    {volunteerHours.length > 0 ? (
                      <div className="space-y-3">
                        {volunteerHours.map((entry) => {
                          const start = new Date(entry.startTime);
                          const end = new Date(entry.endTime);
                          const durationMs = end.getTime() - start.getTime();
                          const hours =
                            Math.round((durationMs / (1000 * 60 * 60)) * 10) /
                            10;

                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-900">
                                  {start.toLocaleDateString()} • {hours} hours
                                </p>
                                <p className="text-sm text-gray-600">
                                  {start.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  -{" "}
                                  {end.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                {entry.description && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {entry.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-500">
                                  Logged{" "}
                                  {new Date(
                                    entry.createdAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500">
                        No volunteer hours logged yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
