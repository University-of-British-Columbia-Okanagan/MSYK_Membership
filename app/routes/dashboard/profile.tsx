import React from "react";
import { useLoaderData, Form, useActionData } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  getProfileDetails,
  checkActiveVolunteerStatus,
  getVolunteerHours,
  logVolunteerHours,
  checkVolunteerHourOverlap,
  updateUserAvatar,
} from "../../models/profile.server";
import type { LoaderFunction } from "react-router-dom";
import fs from "fs";
import path from "path";
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
  Camera,
  X,
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

  // Handle avatar upload/remove actions
  if (action === "uploadAvatar") {
    const avatarFile = formData.get("avatarFile");

    if (!(avatarFile instanceof File) || avatarFile.size === 0) {
      return { error: "No file selected" };
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(avatarFile.type)) {
      return {
        error: "Invalid file type. Please upload JPG, PNG, GIF, or WEBP.",
      };
    }

    if (avatarFile.size > 5 * 1024 * 1024) {
      return { error: "File size exceeds 5MB limit." };
    }

    try {
      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      const filename = `avatar-${roleUser.userId}-${Date.now()}.${avatarFile.name.split(".").pop()}`;
      const imagesDir = path.join(process.cwd(), "public", "images_custom");
      const filepath = path.join(imagesDir, filename);

      // Create directory if it doesn't exist
      await fs.promises.mkdir(imagesDir, { recursive: true });
      await fs.promises.writeFile(filepath, buffer);

      const avatarUrl = `/images_custom/${filename}`;
      await updateUserAvatar(roleUser.userId, avatarUrl);

      return { success: "Profile photo updated successfully!", avatarUrl };
    } catch (error) {
      console.error("Error uploading avatar:", error);
      return { error: "Failed to upload photo. Please try again." };
    }
  }

  if (action === "removeAvatar") {
    try {
      await updateUserAvatar(roleUser.userId, null);
      return { success: "Profile photo removed successfully!" };
    } catch (error) {
      console.error("Error removing avatar:", error);
      return { error: "Failed to remove photo. Please try again." };
    }
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

    // NEW: Validate that start and end are on the same day
    const startDate = new Date(
      startTime.getFullYear(),
      startTime.getMonth(),
      startTime.getDate()
    );
    const endDate = new Date(
      endTime.getFullYear(),
      endTime.getMonth(),
      endTime.getDate()
    );

    if (startDate.getTime() !== endDate.getTime()) {
      return {
        error:
          "Volunteer hours must be logged within the same day. Please split multi-day sessions into separate entries.",
      };
    }

    // NEW: Validate time is between 9 AM (09:00) and 11:45 PM (23:45)
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    // Start time must be >= 9:00 AM
    if (startHour < 9) {
      return { error: "Start time must be 9:00 AM or later" };
    }

    // End time must be <= 11:45 PM
    if (endHour > 23 || (endHour === 23 && endMinute > 45)) {
      return { error: "End time must be 11:45 PM or earlier" };
    }

    // Check if trying to log hours in the future
    const now = new Date();
    if (startTime > now) {
      return { error: "Cannot log volunteer hours for future dates" };
    }
    if (endTime > now) {
      return { error: "Cannot log volunteer hours that end in the future" };
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
    avatarUrl?: string;
  }>();

  // Avatar upload state
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  // State for expanded orientation descriptions
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    new Set()
  );

  const DESCRIPTION_TRUNCATE_LIMIT = 150;

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

  // Toggle expanded description for orientation
  const toggleExpandedDescription = (groupKey: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
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
                {/* Avatar success/error messages */}
                {actionData?.success &&
                  actionData.success.includes("photo") && (
                    <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
                      {actionData.success}
                    </div>
                  )}
                {actionData?.error &&
                  (actionData.error.includes("photo") ||
                    actionData.error.includes("file") ||
                    actionData.error.includes("upload")) && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                      {actionData.error}
                    </div>
                  )}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Avatar with upload functionality */}
                  <div className="relative group">
                    <img
                      src={
                        user.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                      }
                      alt={`${user.name}'s profile`}
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-md object-cover"
                    />
                    {/* Camera overlay button */}
                    <button
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Change profile photo"
                    >
                      <Camera className="h-8 w-8 text-white" />
                    </button>
                    {/* Remove photo button (only if has custom avatar) */}
                    {user.avatarUrl && (
                      <Form method="post" className="absolute -top-1 -right-1">
                        <input
                          type="hidden"
                          name="_action"
                          value="removeAvatar"
                        />
                        <button
                          type="submit"
                          className="bg-red-500 hover:bg-red-600 border-2 border-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                          title="Remove profile photo"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </Form>
                    )}
                    {/* Hidden file input for avatar upload */}
                    <Form
                      method="post"
                      encType="multipart/form-data"
                      onChange={(e) => {
                        const form = e.currentTarget;
                        if (avatarFileInputRef.current?.files?.length) {
                          setIsUploadingAvatar(true);
                          form.submit();
                        }
                      }}
                    >
                      <input
                        type="hidden"
                        name="_action"
                        value="uploadAvatar"
                      />
                      <input
                        ref={avatarFileInputRef}
                        type="file"
                        name="avatarFile"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        className="hidden"
                      />
                    </Form>
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
                                : user.membershipStatus === "revoked"
                                  ? "Revoked"
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
                        <span className="text-gray-600">Billing Cycle</span>
                        <span className="font-medium text-gray-900">
                          {user.billingCycle ?? "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">
                          24/7 Vetting Completed
                        </span>
                        <span className="font-medium text-gray-900">
                          {user.has247Vetting ? "Yes" : "No"}
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
                      // Check if this orientation has a connectId (multi-day)
                      const connectId = orientation.occurrence.connectId;

                      // Create a unique group key for the React key prop
                      const groupKey = connectId
                        ? `${orientation.workshop.id}-${connectId}`
                        : `${orientation.workshop.id}`;

                      // Group by workshop.id AND connectId (if it exists)
                      // This groups all occurrences with same connectId together
                      // And groups single-day by workshop.id
                      const workshopGroup = completedOrientations.filter(
                        (item) => {
                          // If both have connectId, they must match
                          if (
                            connectId !== null &&
                            item.occurrence.connectId !== null
                          ) {
                            return (
                              item.occurrence.connectId === connectId &&
                              item.workshop.id === orientation.workshop.id
                            );
                          }
                          // If neither has connectId, group by workshop.id only
                          if (
                            connectId === null &&
                            item.occurrence.connectId === null
                          ) {
                            return item.workshop.id === orientation.workshop.id;
                          }
                          // Don't mix connectId and non-connectId
                          return false;
                        }
                      );

                      // Only show "Multi-Day" badge if there's a connectId AND multiple sessions
                      const isMultiDay =
                        connectId !== null && workshopGroup.length > 1;

                      // Only render the first occurrence of each group
                      const isFirstOccurrence =
                        completedOrientations.findIndex((item) => {
                          if (
                            connectId !== null &&
                            item.occurrence.connectId !== null
                          ) {
                            return (
                              item.occurrence.connectId === connectId &&
                              item.workshop.id === orientation.workshop.id
                            );
                          }
                          if (
                            connectId === null &&
                            item.occurrence.connectId === null
                          ) {
                            return item.workshop.id === orientation.workshop.id;
                          }
                          return false;
                        }) === index;

                      if (!isFirstOccurrence) return null;

                      return (
                        <div
                          key={groupKey}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-gray-900">
                                  {orientation.workshop.name}
                                </h4>
                                {isMultiDay && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Multi-Day ({workshopGroup.length} sessions)
                                  </span>
                                )}
                              </div>
                              {orientation.workshop.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {expandedDescriptions.has(groupKey) ||
                                  orientation.workshop.description.length <=
                                    DESCRIPTION_TRUNCATE_LIMIT
                                    ? orientation.workshop.description
                                    : orientation.workshop.description.substring(
                                        0,
                                        DESCRIPTION_TRUNCATE_LIMIT
                                      ) + "..."}
                                  {orientation.workshop.description.length >
                                    DESCRIPTION_TRUNCATE_LIMIT && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleExpandedDescription(groupKey)
                                      }
                                      className="text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer ml-1"
                                    >
                                      {expandedDescriptions.has(groupKey)
                                        ? "Show less"
                                        : "Show more"}
                                    </button>
                                  )}
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

                      <Form method="post">
                        <input type="hidden" name="_action" value="logHours" />
                        <input
                          type="hidden"
                          name="startTime"
                          value={startTime}
                        />
                        <input type="hidden" name="endTime" value={endTime} />
                        <input
                          type="hidden"
                          name="isResubmission"
                          value={isResubmission ? "true" : "false"}
                        />

                        <div className="space-y-4">
                          {/* Start Time and End Time Row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Start Time */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Time{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <div className="space-y-2">
                                <input
                                  type="date"
                                  value={
                                    startTime ? startTime.split("T")[0] : ""
                                  }
                                  onChange={(e) => {
                                    const currentTime = startTime
                                      ? startTime.split("T")[1]
                                      : "09:00";
                                    setStartTime(
                                      `${e.target.value}T${currentTime}`
                                    );
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <Select
                                  value={
                                    startTime
                                      ? startTime.split("T")[1]?.substring(0, 5)
                                      : ""
                                  }
                                  onValueChange={(newTime) => {
                                    const date = startTime
                                      ? startTime.split("T")[0]
                                      : "";
                                    if (date) {
                                      setStartTime(`${date}T${newTime}`);
                                    }
                                  }}
                                  disabled={
                                    !startTime || !startTime.includes("T")
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={
                                        !startTime || !startTime.includes("T")
                                          ? "Select date first"
                                          : "Select time"
                                      }
                                    >
                                      {startTime && startTime.includes("T")
                                        ? startTime
                                            .split("T")[1]
                                            ?.substring(0, 5)
                                        : ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64 overflow-y-auto">
                                    {Array.from({ length: 60 }, (_, i) => {
                                      const totalMinutes = 9 * 60 + i * 15;
                                      if (totalMinutes > 23 * 60 + 45)
                                        return null;
                                      const hour = Math.floor(
                                        totalMinutes / 60
                                      );
                                      const minute = totalMinutes % 60;
                                      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                                      return (
                                        <SelectItem
                                          key={timeString}
                                          value={timeString}
                                          className="data-[state=checked]:bg-white"
                                        >
                                          {timeString}
                                        </SelectItem>
                                      );
                                    }).filter(Boolean)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* End Time */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Time <span className="text-red-500">*</span>
                              </label>
                              <div className="space-y-2">
                                <input
                                  type="date"
                                  value={endTime ? endTime.split("T")[0] : ""}
                                  onChange={(e) => {
                                    const currentTime = endTime
                                      ? endTime.split("T")[1]
                                      : "09:00";
                                    setEndTime(
                                      `${e.target.value}T${currentTime}`
                                    );
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <Select
                                  value={
                                    endTime
                                      ? endTime.split("T")[1]?.substring(0, 5)
                                      : ""
                                  }
                                  onValueChange={(newTime) => {
                                    const date = endTime
                                      ? endTime.split("T")[0]
                                      : "";
                                    if (date) {
                                      setEndTime(`${date}T${newTime}`);
                                    }
                                  }}
                                  disabled={!endTime || !endTime.includes("T")}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={
                                        !endTime || !endTime.includes("T")
                                          ? "Select date first"
                                          : "Select time"
                                      }
                                    >
                                      {endTime && endTime.includes("T")
                                        ? endTime.split("T")[1]?.substring(0, 5)
                                        : ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="max-h-64 overflow-y-auto">
                                    {Array.from({ length: 60 }, (_, i) => {
                                      const totalMinutes = 9 * 60 + i * 15;
                                      if (totalMinutes > 23 * 60 + 45)
                                        return null;
                                      const hour = Math.floor(
                                        totalMinutes / 60
                                      );
                                      const minute = totalMinutes % 60;
                                      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                                      return (
                                        <SelectItem
                                          key={timeString}
                                          value={timeString}
                                          className="data-[state=checked]:bg-white"
                                        >
                                          {timeString}
                                        </SelectItem>
                                      );
                                    }).filter(Boolean)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Description{" "}
                              <span className="text-red-500">*</span>
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

                          {/* Submit Button */}
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 flex items-center justify-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Log Hours
                            </button>
                          </div>
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

                      {/* Info about volunteer hour tracking */}
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4 text-left">
                        <div className="flex items-start gap-3">
                          <Clock className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h5 className="text-sm font-semibold text-blue-900 mb-2">
                              Track Your Volunteer Hours
                            </h5>
                            <p className="text-sm text-blue-800 leading-relaxed">
                              Once you become a volunteer, you'll be able to log
                              and track your volunteer hours directly in your
                              profile. This helps us recognize your
                              contributions and provides you with a record of
                              your community service for personal or
                              professional use.
                            </p>
                          </div>
                        </div>
                      </div>

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
