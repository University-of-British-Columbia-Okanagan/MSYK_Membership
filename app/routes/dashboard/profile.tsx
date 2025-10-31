import React from "react";
import { useLoaderData, Form, useActionData } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  getProfileDetails,
  checkActiveVolunteerStatus,
  getVolunteerHours,
  logVolunteerHours,
  checkVolunteerHourOverlap,
} from "../../models/profile.server";
import type { LoaderFunction } from "react-router-dom";
import Sidebar from "../../components/ui/Dashboard/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { UserProfileData } from "~/models/profile.server";
import {
  CreditCard,
  Medal,
  Clock,
  Plus,
  FileText,
  Download,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ShadTable,
  type ColumnDefinition,
} from "~/components/ui/Dashboard/ShadTable";
import { getRoleUser } from "~/utils/session.server";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/guestsidebar";
import type { VolunteerHourEntry } from "../../models/profile.server";
import { getUserCompletedOrientations } from "~/models/workshop.server";

export async function loader({ request }: Parameters<LoaderFunction>[0]) {
  const user = await getProfileDetails(request);
  const roleUser = await getRoleUser(request);

  // Check if user is an active volunteer and get their hours
  let isActiveVolunteer = false;
  let volunteerHours: VolunteerHourEntry[] = [];
  let completedOrientations: any[] = [];

  if (roleUser?.userId) {
    isActiveVolunteer = await checkActiveVolunteerStatus(roleUser.userId);

    if (isActiveVolunteer) {
      volunteerHours = await getVolunteerHours(roleUser.userId, 10);
    }

    // Get user's completed orientations
    completedOrientations = await getUserCompletedOrientations(roleUser.userId);
  }

  return {
    user,
    roleUser,
    isActiveVolunteer,
    volunteerHours,
    completedOrientations,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("_action");

  const roleUser = await getRoleUser(request);

  if (!roleUser?.userId) {
    return { error: "Unauthorized" };
  }

  // Check if user is still an active volunteer
  const isActiveVolunteer = await checkActiveVolunteerStatus(roleUser.userId);
  if (!isActiveVolunteer) {
    return { error: "You must be an active volunteer to log hours" };
  }

  if (action === "logHours") {
    const startTimeStr = formData.get("startTime") as string;
    const endTimeStr = formData.get("endTime") as string;
    const description = formData.get("description") as string;
    const isResubmission = formData.get("isResubmission") === "true";

    // Validate the data
    if (!startTimeStr || !endTimeStr) {
      return { error: "Start time and end time are required" };
    }

    // Add description validation
    if (!description || description.trim() === "") {
      return { error: "Description is required" };
    }

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    // Basic validation
    if (endTime <= startTime) {
      return { error: "End time must be after start time" };
    }

    // Check if trying to log hours in the future
    const now = new Date();
    if (startTime > now) {
      return { error: "Cannot log volunteer hours for future dates" };
    }
    if (endTime > now) {
      return { error: "Cannot log volunteer hours that end in the future" };
    }

    // Check if the time period is reasonable (not more than 24 hours)
    const durationMs = endTime.getTime() - startTime.getTime();
    const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours
    if (durationMs > maxDurationMs) {
      return { error: "Volunteer session cannot be longer than 24 hours" };
    }

    // Check for overlapping volunteer hours (pass isResubmission flag)
    const hasOverlap = await checkVolunteerHourOverlap(
      roleUser.userId,
      startTime,
      endTime,
      isResubmission
    );
    if (hasOverlap) {
      return {
        error:
          "This time period overlaps with existing volunteer hours. Please choose a different time period.",
      };
    }

    try {
      await logVolunteerHours(
        roleUser.userId,
        startTime,
        endTime,
        description.trim(),
        isResubmission
      );
      return { success: "Volunteer hours logged successfully!" };
    } catch (error) {
      console.error("Error logging volunteer hours:", error);
      return { error: "Failed to log volunteer hours. Please try again." };
    }
  }

  return { error: "Invalid action" };
}

export default function ProfilePage() {
  const {
    user,
    roleUser,
    isActiveVolunteer,
    volunteerHours,
    completedOrientations,
  } = useLoaderData<{
    user: UserProfileData;
    roleUser: { roleId: number; roleName: string; userId: number };
    isActiveVolunteer: boolean;
    volunteerHours: VolunteerHourEntry[];
    completedOrientations: any[];
  }>();

  const actionData = useActionData<{
    success?: string;
    error?: string;
  }>();

  // Form state for volunteer hours
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(true);

  // Filtering and pagination state for volunteer hours
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoursPerPage] = useState(5);

  // Applied filters state (only updated when search button is clicked)
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedFromTime, setAppliedFromTime] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [appliedToTime, setAppliedToTime] = useState("");

  // State for expanding denied hours message
  const [showDeniedMessage, setShowDeniedMessage] = useState(false);

  // For resubmission hours
  const [isResubmission, setIsResubmission] = useState(false);

  // Clear form after successful submission and auto-hide success message
  useEffect(() => {
    if (actionData?.success) {
      setStartTime("");
      setEndTime("");
      setDescription("");
      setShowSuccessMessage(true);

      // Auto-hide success message after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  // Check if there are any denied hours to show the resubmit message
  const hasDeniedHours = useMemo(() => {
    return volunteerHours.some((entry) => entry.status === "denied");
  }, [volunteerHours]);

  // Helper function to generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 15, 30, 45]) {
        const formattedHour = hour.toString().padStart(2, "0");
        const formattedMinute = minute.toString().padStart(2, "0");
        options.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    return options;
  };

  // Filter volunteer hours using applied filters
  const filteredVolunteerHours = useMemo(() => {
    if (!isActiveVolunteer || !volunteerHours) return [];

    return volunteerHours.filter((entry) => {
      // Status filter
      const statusMatch =
        statusFilter === "all" || entry.status === statusFilter;

      // Date/time range filtering - only apply if all filter values are set
      let dateTimeMatch = true;
      if (
        appliedFromDate &&
        appliedFromTime &&
        appliedToDate &&
        appliedToTime
      ) {
        const entryStartDate = new Date(entry.startTime);

        // Create from and to datetime objects
        const fromDateTime = new Date(`${appliedFromDate}T${appliedFromTime}`);
        const toDateTime = new Date(`${appliedToDate}T${appliedToTime}`);

        // Check if entry start time is within the range
        dateTimeMatch =
          entryStartDate >= fromDateTime && entryStartDate < toDateTime;
      }

      return statusMatch && dateTimeMatch;
    });
  }, [
    volunteerHours,
    statusFilter,
    appliedFromDate,
    appliedFromTime,
    appliedToDate,
    appliedToTime,
    isActiveVolunteer,
  ]);

  // Sort filtered hours by start time (most recent first)
  const sortedVolunteerHours = useMemo(() => {
    return filteredVolunteerHours
      .slice()
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
  }, [filteredVolunteerHours]);

  // PAGINATION LOGIC
  const totalPages = Math.ceil(sortedVolunteerHours.length / hoursPerPage);
  const startIndex = (currentPage - 1) * hoursPerPage;
  const endIndex = startIndex + hoursPerPage;
  const paginatedVolunteerHours = sortedVolunteerHours.slice(
    startIndex,
    endIndex
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    statusFilter,
    appliedFromDate,
    appliedFromTime,
    appliedToDate,
    appliedToTime,
  ]);

  // Handle search button click
  const handleSearch = () => {
    setAppliedFromDate(fromDate);
    setAppliedFromTime(fromTime);
    setAppliedToDate(toDate);
    setAppliedToTime(toTime);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setStatusFilter("all");
    setFromDate("");
    setFromTime("");
    setToDate("");
    setToTime("");
    setAppliedFromDate("");
    setAppliedFromTime("");
    setAppliedToDate("");
    setAppliedToTime("");
  };

  // Define columns for the ShadTable
  type VolunteerHourRow = (typeof volunteerHours)[number];
  const volunteerHoursColumns: ColumnDefinition<VolunteerHourRow>[] = [
    {
      header: "Date",
      render: (entry) => new Date(entry.startTime).toLocaleDateString(),
    },
    {
      header: "Time",
      render: (entry) => {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        return `${start.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${end.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      },
    },
    {
      header: "Hours",
      render: (entry) => {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;
        return `${hours} hours`;
      },
    },
    {
      header: "Description",
      render: (entry) => entry.description || "—",
    },
    {
      header: "Status",
      render: (entry) => (
        <div className="flex flex-col items-center gap-1">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
              entry.status === "approved"
                ? "bg-green-100 text-green-800"
                : entry.status === "denied"
                  ? "bg-red-100 text-red-800"
                  : entry.status === "resolved"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-indigo-100 text-indigo-800"
            }`}
          >
            {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
          </span>
          {entry.isResubmission && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Resubmission
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Logged",
      render: (entry) => new Date(entry.createdAt).toLocaleDateString(),
    },
  ];

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const getVisiblePageNumbers = () => {
      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push("...", totalPages);
      } else if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots;
    };

    return (
      <div className="flex items-center justify-center space-x-2 mt-4">
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>

        {getVisiblePageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === "..." ? (
              <span className="px-3 py-1 text-sm text-gray-500">...</span>
            ) : (
              <button
                onClick={() => setCurrentPage(Number(page))}
                className={`px-3 py-1 text-sm border rounded ${
                  currentPage === page
                    ? "bg-blue-500 text-white border-blue-500"
                    : "hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    );
  };

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
      <div className="absolute inset-0 flex bg-gray-100">
        {renderSidebar()}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Profile</h1>
            </div>

            {/* Header */}
            <div className="mb-8 hidden md:block">
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-600">
                Manage your account details and preferences
              </p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-6 sm:p-8 bg-gradient-to-r from-indigo-500 to-indigo-600">
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
                    <p className="text-indigo-100 mb-2">{user.email}</p>
                    <div className="inline-block bg-indigo-700 bg-opacity-30 px-3 py-1 rounded-full text-sm text-indigo-50">
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
                      <Medal className="h-5 w-5 text-indigo-500" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Membership Details
                      </h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status</span>
                        <span className="font-medium text-gray-900">
                          {user.membershipStatus === "active"
                            ? "Active"
                            : user.membershipStatus === "ending"
                            ? "Ending"
                            : user.membershipStatus === "cancelled"
                            ? "Cancelled"
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
                      <CreditCard className="h-5 w-5 text-indigo-500" />
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
                          className="block w-full bg-indigo-500 hover:bg-indigo-600 text-white text-center py-2 px-4 rounded-md transition duration-200 font-medium"
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
            <div>
              <div className="p-6 sm:p-8 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Documents
                  </h3>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-gray-900">
                        Waiver and Hold Harmless Agreement
                      </span>
                      <p className="text-sm text-gray-600 mt-1">
                        Your signed liability waiver document
                      </p>
                    </div>
                    <div>
                      {user.waiverSignature &&
                      !user.waiverSignature.includes("Placeholder") ? (
                        <a
                          href="/dashboard/profile/download-waiver"
                          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors text-decoration-none"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500 italic">
                          Waiver document unavailable for download
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Membership Agreement Documents */}
                {user.userMembershipForms &&
                  user.userMembershipForms.length > 0 && (
                    <>
                      {user.userMembershipForms
                        .filter(
                          (form: any) =>
                            form.status !== "inactive" &&
                            form.agreementSignature
                        )
                        .map((form: any, index: number) => (
                          <div
                            key={form.id}
                            className="bg-gray-50 rounded-lg p-4 mt-4"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium text-gray-900">
                                  Membership Agreement
                                  {form.membershipPlan?.needAdminPermission
                                    ? " (24/7)"
                                    : ""}
                                </span>
                                <p className="text-sm text-gray-600 mt-1">
                                  Your signed membership agreement document
                                </p>
                              </div>
                              <div>
                                <a
                                  href={`/dashboard/profile/download-membership-agreement/${form.id}`}
                                  className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors text-decoration-none"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                    </>
                  )}
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

            {/* Orientation History */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Orientation History
                  </h3>
                </div>
              </div>
              <div className="p-6">
                {completedOrientations.length > 0 ? (
                  <div className="space-y-4">
                    {completedOrientations.map((orientation, index) => {
                      // Check if this is a multi-day orientation by grouping by workshop
                      const workshopGroup = completedOrientations.filter(
                        (item) => item.workshop.id === orientation.workshop.id
                      );

                      // Only render the first occurrence of each workshop
                      const isFirstOccurrence =
                        completedOrientations.findIndex(
                          (item) => item.workshop.id === orientation.workshop.id
                        ) === index;

                      if (!isFirstOccurrence) return null;

                      return (
                        <div
                          key={orientation.workshop.id}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-1">
                                {orientation.workshop.name}
                              </h4>
                              {orientation.workshop.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {orientation.workshop.description}
                                </p>
                              )}

                              {/* Price Variation Display */}
                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="text-green-600 font-medium">
                                  ✓ Completed
                                </span>

                                {orientation.priceVariation ? (
                                  <span className="text-blue-600">
                                    Variation: {orientation.priceVariation.name}{" "}
                                    - CA$
                                    {orientation.priceVariation.price.toFixed(
                                      2
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-blue-600">
                                    No variation - CA$
                                    {orientation.workshop.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Date(s) Display */}
                            <div className="text-right">
                              {workshopGroup.length > 1 ? (
                                <div className="text-sm text-gray-600">
                                  <p className="font-medium">
                                    Multi-day training/orientation:
                                  </p>
                                  {workshopGroup
                                    .sort(
                                      (a, b) =>
                                        new Date(
                                          a.occurrence.startDate
                                        ).getTime() -
                                        new Date(
                                          b.occurrence.startDate
                                        ).getTime()
                                    )
                                    .map((item, idx) => (
                                      <p key={idx}>
                                        {new Date(
                                          item.occurrence.startDate
                                        ).toLocaleDateString("en-CA", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        {item.occurrence.startDate !==
                                          item.occurrence.endDate && (
                                          <span className="text-gray-500">
                                            {" - "}
                                            {new Date(
                                              item.occurrence.endDate
                                            ).toLocaleDateString("en-CA", {
                                              month: "short",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        )}
                                      </p>
                                    ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-600">
                                  <p>
                                    {new Date(
                                      orientation.occurrence.startDate
                                    ).toLocaleDateString("en-CA", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  {orientation.occurrence.startDate !==
                                    orientation.occurrence.endDate && (
                                    <p className="text-gray-500">
                                      to{" "}
                                      {new Date(
                                        orientation.occurrence.endDate
                                      ).toLocaleDateString("en-CA", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                Registered:{" "}
                                {new Date(orientation.date).toLocaleDateString(
                                  "en-CA"
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-300">
                      <Medal className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        No Training History
                      </h4>
                      <p className="text-gray-600 mb-4">
                        Complete orientations to see your training history here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Volunteer Hours Section */}
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
                {isActiveVolunteer ? (
                  <>
                    {/* Add Hours Form */}
                    <div className="bg-blue-50 rounded-lg p-4 mb-6">
                      <h4 className="font-bold text-blue-900 mb-4">
                        Log New Hours
                      </h4>

                      {/* Description/Instructions */}
                      <div className="bg-blue-100 border border-blue-200 rounded-md p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>How to log volunteer hours:</strong> Select
                          the start and end time for your volunteer session. You
                          must add a brief description of what you worked on.
                          Your hours will be reviewed and approved by an
                          administrator
                        </p>
                      </div>

                      {/* Success/Error Messages */}
                      {actionData?.success && showSuccessMessage && (
                        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
                          {actionData.success}
                        </div>
                      )}
                      {actionData?.error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                          {actionData.error}
                        </div>
                      )}

                      <Form
                        method="post"
                        className="grid grid-cols-1 md:grid-cols-4 gap-4"
                      >
                        <input type="hidden" name="_action" value="logHours" />
                        <input
                          type="hidden"
                          name="isResubmission"
                          value={isResubmission ? "true" : "false"}
                        />

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Time <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            name="startTime"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Time <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            name="endTime"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What did you work on?"
                            required
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

                      {hasDeniedHours && (
                        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              id="isResubmission"
                              name="isResubmission"
                              value="true"
                              checked={isResubmission}
                              onChange={(e) =>
                                setIsResubmission(e.target.checked)
                              }
                              className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <label
                                htmlFor="isResubmission"
                                className="text-sm font-medium text-blue-900 cursor-pointer"
                              >
                                This is a resubmission for denied hours
                              </label>
                              <p className="text-xs text-blue-700 mt-1">
                                Check this if you're resubmitting hours that
                                were previously denied. This allows you to use
                                the same or overlapping time periods and helps
                                administrators track resubmissions.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Recent Hours */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">
                          Recent Hours
                        </h4>
                      </div>

                      {/* Description/Instructions for Recent Hours */}
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                        <p className="text-sm text-gray-700">
                          <strong>Your volunteer history:</strong> View all your
                          logged volunteer hours below. You can filter by status
                          (pending, approved, denied) or search by date range.
                          Hours show as "pending" until reviewed by an
                          administrator. Use the filters below to find specific
                          volunteer sessions. The filter to and from inputs is
                          based off start dates and times
                        </p>
                      </div>

                      {/* Collapsible Denied Hours Notice */}
                      {isActiveVolunteer && hasDeniedHours && (
                        <div className="mb-4">
                          {/* Collapsed State - Just the clickable header */}
                          <div
                            onClick={() =>
                              setShowDeniedMessage(!showDeniedMessage)
                            }
                            className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <svg
                                className="h-4 w-4 text-orange-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="text-sm font-medium text-orange-800">
                                Notice About Denied Hours
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-orange-600">
                                {showDeniedMessage ? "Hide" : "Show"}
                              </span>
                              <svg
                                className={`h-4 w-4 text-orange-500 transition-transform ${
                                  showDeniedMessage ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </div>

                          {/* Expanded State */}
                          {showDeniedMessage && (
                            <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <p className="text-sm text-orange-700">
                                If any of your volunteer hours were denied by an
                                admin, please contact the Makerspace YK team for
                                more information.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Filters Row */}
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                        {/* Status Filter */}
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1">
                            Filter by status:
                          </label>
                          <Select
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="denied">Denied</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* From Date */}
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1">
                            From date:
                          </label>
                          <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* From Time */}
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1">
                            From time:
                          </label>
                          <Select
                            value={fromTime}
                            onValueChange={setFromTime}
                            disabled={!fromDate}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  !fromDate
                                    ? "Select date first"
                                    : "Select time"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {generateTimeOptions().map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* To Date */}
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1">
                            To date:
                          </label>
                          <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* To Time */}
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1">
                            To time:
                          </label>
                          <Select
                            value={toTime}
                            onValueChange={setToTime}
                            disabled={!toDate}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  !toDate ? "Select date first" : "Select time"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {generateTimeOptions().map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Search Button */}
                        <div className="flex flex-col justify-end">
                          <button
                            onClick={handleSearch}
                            disabled={
                              !fromDate || !fromTime || !toDate || !toTime
                            }
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Search
                          </button>
                        </div>
                      </div>

                      {/* Clear Filters Button */}
                      {(statusFilter !== "all" ||
                        appliedFromDate ||
                        appliedFromTime ||
                        appliedToDate ||
                        appliedToTime) && (
                        <div className="mb-4">
                          <button
                            onClick={handleClearFilters}
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>
                            Showing {startIndex + 1}-
                            {Math.min(endIndex, sortedVolunteerHours.length)} of{" "}
                            {sortedVolunteerHours.length} entries
                            {appliedFromDate &&
                              appliedFromTime &&
                              appliedToDate &&
                              appliedToTime && (
                                <span className="ml-2 text-blue-600">
                                  (filtered from{" "}
                                  {new Date(
                                    `${appliedFromDate}T${appliedFromTime}`
                                  ).toLocaleString()}{" "}
                                  to{" "}
                                  {new Date(
                                    `${appliedToDate}T${appliedToTime}`
                                  ).toLocaleString()}
                                  )
                                </span>
                              )}
                          </span>
                          <span className="font-bold">
                            Total:{" "}
                            {filteredVolunteerHours
                              .reduce((total, entry) => {
                                const start = new Date(entry.startTime);
                                const end = new Date(entry.endTime);
                                const durationMs =
                                  end.getTime() - start.getTime();
                                const hours = durationMs / (1000 * 60 * 60);
                                return total + hours;
                              }, 0)
                              .toFixed(1)}{" "}
                            hours
                          </span>
                        </div>
                      </div>

                      {sortedVolunteerHours.length > 0 ? (
                        <>
                          <ShadTable
                            columns={volunteerHoursColumns}
                            data={paginatedVolunteerHours}
                            emptyMessage="No volunteer hours found for the selected filters"
                          />
                          {renderPagination()}
                        </>
                      ) : (
                        <p className="text-gray-500 text-center py-8">
                          {volunteerHours.length === 0
                            ? "No volunteer hours logged yet."
                            : "No volunteer hours match the selected filters."}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  /* Non-volunteer message */
                  <div className="text-center py-8">
                    <div className="bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-300">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        Volunteer Access Required
                      </h4>
                      <p className="text-gray-600 mb-4">
                        This section is only accessible to active volunteers.
                      </p>
                      <p className="text-sm text-gray-500">
                        Interested in volunteering? Contact us to learn more
                        about volunteer opportunities!
                      </p>
                      <div className="mt-4">
                        <a
                          href="/dashboard/volunteer"
                          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Learn About Volunteering
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
