import { useState } from "react";
import { useLoaderData, redirect } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FiSearch } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import { format, differenceInSeconds } from "date-fns";
import { getIssues, updateIssueStatus } from "~/models/issue.server";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "~/components/ui/select";
import { SelectTrigger } from "@radix-ui/react-select";
import { logger } from "~/logging/logger";
import { getAllVolunteerHours } from "~/models/profile.server";

/**
 * Convert workshop occurrence data to CSV string
 */
const generateCSV = (workshopOccurrences: any[]) => {
  // Define CSV headers
  const headers = [
    "Workshop Name",
    "Workshop Type",
    "ID",
    "Start Date",
    "End Date",
    "Duration",
    "Registered Users",
    "Offer ID",
    "Status",
  ];

  // Create CSV content rows
  const rows = workshopOccurrences.flatMap((workshop) =>
    workshop.occurrences.map((occ: any) => [
      workshop.name,
      workshop.type,
      occ.id,
      new Date(occ.startDate).toLocaleString(),
      new Date(occ.endDate).toLocaleString(),
      calculateDuration(occ.startDate, occ.endDate),
      occ.registrationCount,
      occ.offerId,
      occ.status,
    ])
  );

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row: string[]) =>
      row.map((cell: string | number) => `"${cell}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
};

/**
 * Download data as a CSV file
 */
const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function getStatusVariant(status: string) {
  switch (status) {
    case "open":
      return "destructive";
    case "in_progress":
      return "secondary";
    case "resolved":
      return "success";
    default:
      return "default";
  }
}

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`Unauthorized access attempt to admin loader`, {
      userId: roleUser?.userId ?? "unknown",
      role: roleUser?.roleName ?? "none",
      url: request.url,
    });
    return redirect("/dashboard/user");
  }

  try {
    const workshops = await getWorkshops();
    const issues = await getIssues();
    const volunteerHours = await getAllVolunteerHours();

    logger.info(`[User: ${roleUser.userId}] Admin dashboard data loaded`, {
      url: request.url,
      workshopCount: workshops.length,
      issueCount: issues.length,
    });

    return {
      roleUser,
      workshops,
      issues,
      volunteerHours,
    };
  } catch (error) {
    logger.error(`Error loading admin dashboard data: ${error}`, {
      userId: roleUser.userId,
      url: request.url,
    });
    throw new Response("Failed to load data", { status: 500 });
  }
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const actionType = rawValues._action;

  if (actionType === "change-issue-status") {
    const roleUser = await getRoleUser(request);
    if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
      logger.warn(`Unauthorized attempt to change issue status`, {
        url: request.url,
      });
      throw new Response("Not Authorized", { status: 419 });
    }

    const issueId = parseInt(rawValues.issueId as string);
    const newStatus = rawValues.newStatus as string;

    if (!issueId || !newStatus) {
      logger.error(`Missing fields for issue status update`, {
        issueId,
        newStatus,
        url: request.url,
      });
      throw new Response("Missing required fields", { status: 400 });
    }

    try {
      await updateIssueStatus(issueId, newStatus);
      logger.info(
        `[User: ${roleUser.userId}] change-issue-status executed for issue ${issueId} -> ${newStatus}`,
        {
          issueId,
          newStatus,
          url: request.url,
        }
      );
      return redirect("/dashboard/admin/reports");
    } catch (error) {
      logger.error(
        `Error updating issue status for issue ${issueId}: ${error}`,
        {
          issueId,
          newStatus,
          url: request.url,
        }
      );
      throw new Response("Failed to update issue status", { status: 500 });
    }
  }

  logger.warn(`Unknown action attempted: ${actionType}`, { url: request.url });
  throw new Response("Unknown action", { status: 400 });
}

// Calculate duration between two dates and return as appropriate unit
const calculateDuration = (startDateString: string, endDateString: string) => {
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);

  const seconds = differenceInSeconds(endDate, startDate);

  // Less than a minute
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  // Convert to total minutes for more precise calculations
  const totalMinutes = Math.floor(seconds / 60);

  // If less than an hour, just show minutes
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""}`;
  }

  // Calculate hours and remaining minutes
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  // If duration is exact hours (no remaining minutes)
  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  // Otherwise, show both hours and minutes
  return `${hours} hour${
    hours !== 1 ? "s" : ""
  } and ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
};

export default function AdminReports() {
  const { roleUser, workshops, issues, volunteerHours } = useLoaderData<{
    roleUser: { roleId: number; roleName: string };
    workshops: Array<{
      id: number;
      name: string;
      description: string;
      price: number;
      location: string;
      type: string;
      status: string;
      occurrences: Array<{
        id: number;
        startDate: string;
        endDate: string;
        status: string;
        offerId: number;
        registrationCount: number;
      }>;
    }>;
    issues: Issue[];
    volunteerHours: Array<{
      id: number;
      userId: number;
      startTime: string;
      endTime: string;
      description: string;
      status: string;
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
    }>;
  }>();

  const [searchTerm, setSearchTerm] = useState("");

  // filtering and searching for issues
  const [statusFilter, setStatusFilter] = useState("all");
  const [issueSearchTerm, setIssueSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const filteredAndSortedIssues = issues
    .filter(
      (issue) =>
        (statusFilter === "all" || issue.status === statusFilter) &&
        (issue.title.toLowerCase().includes(issueSearchTerm.toLowerCase()) ||
          issue.reportedBy?.email
            ?.toLowerCase()
            .includes(issueSearchTerm.toLowerCase()) ||
          issue.reportedBy?.id
            ?.toString()
            .toLowerCase()
            .includes(issueSearchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status);
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === "oldest" ? dateA - dateB : dateB - dateA;
    });

  // Filter workshops based on search term
  const filteredWorkshops = workshops.filter((workshop) =>
    workshop.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Volunteer Reports state
  const [volunteerFirstName, setVolunteerFirstName] = useState("");
  const [volunteerLastName, setVolunteerLastName] = useState("");
  const [volunteerStatus, setVolunteerStatus] = useState("all");

  // Date/Time filter state for volunteer reports
  const [fromDate, setFromDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("");

  // Applied filters (for search button) for volunteer reports
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedFromTime, setAppliedFromTime] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [appliedToTime, setAppliedToTime] = useState("");

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "MMM d, yyyy h:mm a");
  };

  // Group occurrences by workshop and status
  const groupedOccurrences = filteredWorkshops.map((workshop) => {
    const activeOccurrences = workshop.occurrences
      .filter((occ) => occ.status === "active")
      .sort((a, b) => a.id - b.id); // Sort by ID ascending

    const pastOccurrences = workshop.occurrences
      .filter((occ) => occ.status === "past" || occ.status === "cancelled")
      .sort((a, b) => a.id - b.id); // Sort by ID ascending

    return {
      ...workshop,
      activeOccurrences,
      pastOccurrences,
    };
  });

  // Count all active and past occurrences across all workshops
  const totalActiveOccurrences = groupedOccurrences.reduce(
    (total, workshop) => total + workshop.activeOccurrences.length,
    0
  );

  const totalPastOccurrences = groupedOccurrences.reduce(
    (total, workshop) => total + workshop.pastOccurrences.length,
    0
  );

  // Prepare data for CSV export - Active workshops
  const handleDownloadActiveCSV = () => {
    // Create flattened data structure for CSV
    const activeWorkshopData = groupedOccurrences
      .filter((workshop) => workshop.activeOccurrences.length > 0)
      .map((workshop) => ({
        ...workshop,
        occurrences: workshop.activeOccurrences,
      }));

    const csvContent = generateCSV(activeWorkshopData);
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    downloadCSV(csvContent, `active-workshops-${dateStr}.csv`);
  };

  // Prepare data for CSV export - Past workshops
  const handleDownloadPastCSV = () => {
    // Create flattened data structure for CSV
    const pastWorkshopData = groupedOccurrences
      .filter((workshop) => workshop.pastOccurrences.length > 0)
      .map((workshop) => ({
        ...workshop,
        occurrences: workshop.pastOccurrences,
      }));

    const csvContent = generateCSV(pastWorkshopData);
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    downloadCSV(csvContent, `past-workshops-${dateStr}.csv`);
  };

  function handleChangeStatus(issueId: string, newStatus: string) {
    const form = document.createElement("form");
    form.method = "post";
    form.style.display = "none";

    const fields = {
      _action: "change-issue-status",
      issueId,
      newStatus,
    };

    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

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

  // Handle search button click
  const handleVolunteerSearch = () => {
    setAppliedFromDate(fromDate);
    setAppliedFromTime(fromTime);
    setAppliedToDate(toDate);
    setAppliedToTime(toTime);
  };

  // Handle clear filters
  const handleClearVolunteerFilters = () => {
    setVolunteerFirstName("");
    setVolunteerLastName("");
    setVolunteerStatus("all");
    setFromDate("");
    setFromTime("");
    setToDate("");
    setToTime("");
    setAppliedFromDate("");
    setAppliedFromTime("");
    setAppliedToDate("");
    setAppliedToTime("");
  };

  // Generate CSV for volunteer hours
  const generateVolunteerCSV = () => {
    // Get all filtered hours (not just paginated)
    const filteredHours = volunteerHours.filter((hour) => {
      const firstNameMatch =
        volunteerFirstName === "" ||
        hour.user.firstName
          .toLowerCase()
          .includes(volunteerFirstName.toLowerCase());
      const lastNameMatch =
        volunteerLastName === "" ||
        hour.user.lastName
          .toLowerCase()
          .includes(volunteerLastName.toLowerCase());
      const statusMatch =
        volunteerStatus === "all" || hour.status === volunteerStatus;

      let dateTimeMatch = true;
      if (
        appliedFromDate &&
        appliedFromTime &&
        appliedToDate &&
        appliedToTime
      ) {
        const entryStartDate = new Date(hour.startTime);
        const fromDateTime = new Date(`${appliedFromDate}T${appliedFromTime}`);
        const toDateTime = new Date(`${appliedToDate}T${appliedToTime}`);
        dateTimeMatch =
          entryStartDate >= fromDateTime && entryStartDate < toDateTime;
      }

      return firstNameMatch && lastNameMatch && statusMatch && dateTimeMatch;
    });

    // CSV Headers
    const headers = [
      "User Name",
      "Email",
      "Date",
      "Start Time",
      "End Time",
      "Duration (Hours)",
      "Description",
      "Status",
    ];

    // Convert data to CSV rows
    const rows = filteredHours
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      .map((hour) => {
        const start = new Date(hour.startTime);
        const end = new Date(hour.endTime);
        const durationMs = end.getTime() - start.getTime();
        const hoursDec = (durationMs / (1000 * 60 * 60)).toFixed(2);

        return [
          `${hour.user.firstName} ${hour.user.lastName}`,
          hour.user.email,
          start.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          start.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          end.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          hoursDec,
          hour.description || "",
          hour.status,
        ];
      });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    return csvContent;
  };

  // Download CSV file
  const handleDownloadCSV = () => {
    const csvContent = generateVolunteerCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    // Generate filename with current date
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `volunteer-hours-report-${today}.csv`);

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        <AdminAppSidebar />
        <main className="flex-grow p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Admin Reports</h1>
            </div>

            <div className="flex items-center gap-2 mb-6 hidden md:flex">
              <Settings className="h-6 w-6 text-indigo-500" />
              <h1 className="text-2xl font-bold">Admin Reports</h1>
            </div>

            <Tabs defaultValue="workshops" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="workshops">Workshop Reports</TabsTrigger>
                {/* Additional report tabs can be added here */}
                <TabsTrigger value="placeholder">Equipment Reports</TabsTrigger>
                <TabsTrigger value="placeholder2">User Reports</TabsTrigger>
                <TabsTrigger value="volunteers">Volunteer Reports</TabsTrigger>
                <TabsTrigger value="issues">Reported Issues</TabsTrigger>
              </TabsList>

              {/* Workshop Reports Tab */}
              <TabsContent value="workshops">
                <div className="mb-6 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FiSearch className="text-gray-500" />
                    <Input
                      placeholder="Search workshops by name"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full md:w-80"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 border-green-300 text-green-800"
                    >
                      {totalActiveOccurrences} Active Sessions
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-gray-100 border-gray-300 text-gray-600"
                    >
                      {totalPastOccurrences} Past Sessions
                    </Badge>
                  </div>
                </div>

                {/* Workshop Dates Tab Group */}
                <Tabs defaultValue="active" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="active">
                      Active Workshop Dates
                    </TabsTrigger>
                    <TabsTrigger value="past">Past Workshop Dates</TabsTrigger>
                  </TabsList>

                  {/* Active Workshop Dates Tab */}
                  <TabsContent value="active">
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>Active Workshop Dates</CardTitle>
                            <CardDescription>
                              All upcoming workshop sessions listed by workshop
                            </CardDescription>
                          </div>
                          <Button
                            onClick={handleDownloadActiveCSV}
                            variant="outline"
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          >
                            Download CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {groupedOccurrences.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">
                            No workshops found.
                          </div>
                        ) : (
                          groupedOccurrences
                            .map(
                              (workshop) =>
                                workshop.activeOccurrences.length > 0 && (
                                  <div key={workshop.id} className="mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                      <h3 className="text-lg font-semibold flex items-center">
                                        {workshop.name}
                                        <Badge
                                          variant="outline"
                                          className="ml-2 bg-blue-50 border-blue-200 text-blue-700"
                                        >
                                          {workshop.type}
                                        </Badge>
                                      </h3>
                                      <Badge
                                        variant="outline"
                                        className="bg-green-50 border-green-200"
                                      >
                                        {workshop.activeOccurrences.length}{" "}
                                        Active Sessions
                                      </Badge>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>ID</TableHead>
                                          <TableHead>Start Date</TableHead>
                                          <TableHead>End Date</TableHead>
                                          <TableHead>Duration</TableHead>
                                          <TableHead>
                                            Registered Users
                                          </TableHead>
                                          <TableHead>Offer ID</TableHead>
                                          <TableHead>Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {workshop.activeOccurrences.map(
                                          (occurrence) => (
                                            <TableRow key={occurrence.id}>
                                              <TableCell className="font-medium">
                                                {occurrence.id}
                                              </TableCell>
                                              <TableCell>
                                                {formatDate(
                                                  occurrence.startDate
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {formatDate(occurrence.endDate)}
                                              </TableCell>
                                              <TableCell>
                                                {calculateDuration(
                                                  occurrence.startDate,
                                                  occurrence.endDate
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {occurrence.registrationCount}
                                              </TableCell>
                                              <TableCell>
                                                {occurrence.offerId}
                                              </TableCell>
                                              <TableCell>
                                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                                  {occurrence.status}
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          )
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )
                            )
                            .filter(Boolean)
                        )}
                        {groupedOccurrences.every(
                          (workshop) => workshop.activeOccurrences.length === 0
                        ) && (
                          <div className="text-center py-10 text-gray-500">
                            No active workshop dates found.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Past Workshop Dates Tab */}
                  <TabsContent value="past">
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>Past Workshop Dates</CardTitle>
                            <CardDescription>
                              All completed or cancelled workshop sessions
                            </CardDescription>
                          </div>
                          <Button
                            onClick={handleDownloadPastCSV}
                            variant="outline"
                            className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                          >
                            Download CSV
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {groupedOccurrences.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">
                            No workshops found.
                          </div>
                        ) : (
                          groupedOccurrences
                            .map(
                              (workshop) =>
                                workshop.pastOccurrences.length > 0 && (
                                  <div key={workshop.id} className="mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                      <h3 className="text-lg font-semibold flex items-center">
                                        {workshop.name}
                                        <Badge
                                          variant="outline"
                                          className="ml-2 bg-blue-50 border-blue-200 text-blue-700"
                                        >
                                          {workshop.type}
                                        </Badge>
                                      </h3>
                                      <Badge
                                        variant="outline"
                                        className="bg-gray-50 border-gray-200"
                                      >
                                        {workshop.pastOccurrences.length} Past
                                        Sessions
                                      </Badge>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>ID</TableHead>
                                          <TableHead>Start Date</TableHead>
                                          <TableHead>End Date</TableHead>
                                          <TableHead>Duration</TableHead>
                                          <TableHead>
                                            Registered Users
                                          </TableHead>
                                          <TableHead>Offer ID</TableHead>
                                          <TableHead>Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {workshop.pastOccurrences.map(
                                          (occurrence) => (
                                            <TableRow key={occurrence.id}>
                                              <TableCell className="font-medium">
                                                {occurrence.id}
                                              </TableCell>
                                              <TableCell>
                                                {formatDate(
                                                  occurrence.startDate
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {formatDate(occurrence.endDate)}
                                              </TableCell>
                                              <TableCell>
                                                {calculateDuration(
                                                  occurrence.startDate,
                                                  occurrence.endDate
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {occurrence.registrationCount}
                                              </TableCell>
                                              <TableCell>
                                                {occurrence.offerId}
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  className={
                                                    occurrence.status ===
                                                    "cancelled"
                                                      ? "bg-red-100 text-red-800 border-red-300"
                                                      : "bg-gray-100 text-gray-800 border-gray-300"
                                                  }
                                                >
                                                  {occurrence.status}
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          )
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )
                            )
                            .filter(Boolean)
                        )}
                        {groupedOccurrences.every(
                          (workshop) => workshop.pastOccurrences.length === 0
                        ) && (
                          <div className="text-center py-10 text-gray-500">
                            No past workshop dates found.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Placeholder for other report types */}
              <TabsContent value="placeholder">
                <Card>
                  <CardHeader>
                    <CardTitle>Equipment Reports</CardTitle>
                    <CardDescription>
                      Reports on equipment usage and bookings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">
                      Equipment reports will be added here in the future.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="placeholder2">
                <Card>
                  <CardHeader>
                    <CardTitle>User Reports</CardTitle>
                    <CardDescription>
                      Reports on user activity and registrations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">
                      User reports will be added here in the future.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Volunteer Reports Tab */}
              <TabsContent value="volunteers">
                {/* Search and Filter Section - Outside Card */}
                <div className="mb-6 space-y-4">
                  {/* Name and Status Filters with Download CSV Buttons */}
                  <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <FiSearch className="text-gray-500" />
                        <Input
                          placeholder="First Name"
                          value={volunteerFirstName}
                          onChange={(e) =>
                            setVolunteerFirstName(e.target.value)
                          }
                          className="w-40"
                        />
                      </div>
                      <Input
                        placeholder="Last Name"
                        value={volunteerLastName}
                        onChange={(e) => setVolunteerLastName(e.target.value)}
                        className="w-40"
                      />
                      <select
                        value={volunteerStatus}
                        onChange={(e) => setVolunteerStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm h-10"
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="denied">Denied</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    {/* Download CSV Buttons */}
                    <div className="flex gap-2">
                      {/* Download Detailed CSV Button */}
                      <Button
                        onClick={() => {
                          // Filter hours based on current filters
                          const filteredHours = volunteerHours.filter(
                            (hour) => {
                              const firstNameMatch =
                                volunteerFirstName === "" ||
                                hour.user.firstName
                                  .toLowerCase()
                                  .includes(volunteerFirstName.toLowerCase());
                              const lastNameMatch =
                                volunteerLastName === "" ||
                                hour.user.lastName
                                  .toLowerCase()
                                  .includes(volunteerLastName.toLowerCase());
                              const statusMatch =
                                volunteerStatus === "all" ||
                                hour.status === volunteerStatus;

                              let dateTimeMatch = true;
                              if (
                                appliedFromDate &&
                                appliedFromTime &&
                                appliedToDate &&
                                appliedToTime
                              ) {
                                const entryStartDate = new Date(hour.startTime);
                                const fromDateTime = new Date(
                                  `${appliedFromDate}T${appliedFromTime}`
                                );
                                const toDateTime = new Date(
                                  `${appliedToDate}T${appliedToTime}`
                                );
                                dateTimeMatch =
                                  entryStartDate >= fromDateTime &&
                                  entryStartDate < toDateTime;
                              }

                              return (
                                firstNameMatch &&
                                lastNameMatch &&
                                statusMatch &&
                                dateTimeMatch
                              );
                            }
                          );

                          // CSV Headers
                          const headers = [
                            "User Name",
                            "Email",
                            "Date",
                            "Start Time",
                            "End Time",
                            "Duration (Hours)",
                            "Status",
                          ];

                          // Convert data to CSV rows
                          const rows = filteredHours
                            .sort(
                              (a, b) =>
                                new Date(a.startTime).getTime() -
                                new Date(b.startTime).getTime()
                            )
                            .map((hour) => {
                              const start = new Date(hour.startTime);
                              const end = new Date(hour.endTime);
                              const durationMs =
                                end.getTime() - start.getTime();
                              const hoursDec = (
                                durationMs /
                                (1000 * 60 * 60)
                              ).toFixed(2);

                              return [
                                `${hour.user.firstName} ${hour.user.lastName}`,
                                hour.user.email,
                                start.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }),
                                start.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }),
                                end.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }),
                                hoursDec,
                                hour.status,
                              ];
                            });

                          // Combine headers and rows
                          const csvContent = [
                            headers.join(","),
                            ...rows.map((row) =>
                              row
                                .map(
                                  (cell) =>
                                    `"${String(cell).replace(/"/g, '""')}"`
                                )
                                .join(",")
                            ),
                          ].join("\n");

                          // Download CSV
                          const blob = new Blob([csvContent], {
                            type: "text/csv;charset=utf-8;",
                          });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.setAttribute("href", url);

                          // Generate filename with current date
                          const today = new Date().toISOString().split("T")[0];
                          link.setAttribute(
                            "download",
                            `volunteer-hours-detailed-${today}.csv`
                          );

                          link.style.visibility = "hidden";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        variant="outline"
                        className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      >
                        Download CSV
                      </Button>

                      {/* Download Total Hours CSV Button */}
                      <Button
                        onClick={() => {
                          // Filter hours based on current filters
                          const filteredHours = volunteerHours.filter(
                            (hour) => {
                              const firstNameMatch =
                                volunteerFirstName === "" ||
                                hour.user.firstName
                                  .toLowerCase()
                                  .includes(volunteerFirstName.toLowerCase());
                              const lastNameMatch =
                                volunteerLastName === "" ||
                                hour.user.lastName
                                  .toLowerCase()
                                  .includes(volunteerLastName.toLowerCase());
                              const statusMatch =
                                volunteerStatus === "all" ||
                                hour.status === volunteerStatus;

                              let dateTimeMatch = true;
                              if (
                                appliedFromDate &&
                                appliedFromTime &&
                                appliedToDate &&
                                appliedToTime
                              ) {
                                const entryStartDate = new Date(hour.startTime);
                                const fromDateTime = new Date(
                                  `${appliedFromDate}T${appliedFromTime}`
                                );
                                const toDateTime = new Date(
                                  `${appliedToDate}T${appliedToTime}`
                                );
                                dateTimeMatch =
                                  entryStartDate >= fromDateTime &&
                                  entryStartDate < toDateTime;
                              }

                              return (
                                firstNameMatch &&
                                lastNameMatch &&
                                statusMatch &&
                                dateTimeMatch
                              );
                            }
                          );

                          // Group by user and calculate totals
                          type UserTotal = {
                            userName: string;
                            userEmail: string;
                            totalHours: number;
                            earliestDate: Date;
                            latestDate: Date;
                          };

                          const userTotalsMap = new Map<number, UserTotal>();

                          filteredHours.forEach((hour) => {
                            const userId = hour.userId;
                            const userName = `${hour.user.firstName} ${hour.user.lastName}`;
                            const userEmail = hour.user.email;
                            const startTime = new Date(hour.startTime);
                            const endTime = new Date(hour.endTime);
                            const durationMs =
                              endTime.getTime() - startTime.getTime();
                            const hoursDec = durationMs / (1000 * 60 * 60);

                            const existing = userTotalsMap.get(userId);

                            if (!existing) {
                              userTotalsMap.set(userId, {
                                userName,
                                userEmail,
                                totalHours: hoursDec,
                                earliestDate: startTime,
                                latestDate: endTime,
                              });
                            } else {
                              existing.totalHours += hoursDec;

                              // Update earliest and latest dates
                              if (startTime < existing.earliestDate) {
                                existing.earliestDate = startTime;
                              }
                              if (endTime > existing.latestDate) {
                                existing.latestDate = endTime;
                              }
                            }
                          });

                          // CSV Headers
                          const headers = [
                            "User Name",
                            "Email",
                            "Total Hours",
                            "Period Start",
                            "Period End",
                          ];

                          // Convert data to CSV rows
                          const rows = Array.from(userTotalsMap.values())
                            .sort((a, b) =>
                              a.userName.localeCompare(b.userName)
                            )
                            .map((user) => {
                              return [
                                user.userName,
                                user.userEmail,
                                user.totalHours.toFixed(2),
                                user.earliestDate.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }),
                                user.latestDate.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }),
                              ];
                            });

                          // Combine headers and rows
                          const csvContent = [
                            headers.join(","),
                            ...rows.map((row) =>
                              row
                                .map(
                                  (cell) =>
                                    `"${String(cell).replace(/"/g, '""')}"`
                                )
                                .join(",")
                            ),
                          ].join("\n");

                          // Download CSV
                          const blob = new Blob([csvContent], {
                            type: "text/csv;charset=utf-8;",
                          });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.setAttribute("href", url);

                          // Generate filename with current date
                          const today = new Date().toISOString().split("T")[0];
                          link.setAttribute(
                            "download",
                            `volunteer-hours-totals-${today}.csv`
                          );

                          link.style.visibility = "hidden";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        variant="outline"
                        className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      >
                        Download Total Hours CSV
                      </Button>
                    </div>
                  </div>

                  {/* Date and Time Filters - Inline Layout */}
                  <div className="flex flex-wrap gap-4 items-end">
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
                        <SelectTrigger className="w-[180px]">
                          <SelectValue
                            placeholder={
                              !fromDate ? "Select date first" : "Select time"
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
                        <SelectTrigger className="w-[180px]">
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
                        onClick={handleVolunteerSearch}
                        disabled={!fromDate || !fromTime || !toDate || !toTime}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Clear Filters Link */}
                  {(volunteerFirstName ||
                    volunteerLastName ||
                    volunteerStatus !== "all" ||
                    appliedFromDate ||
                    appliedFromTime ||
                    appliedToDate ||
                    appliedToTime) && (
                    <button
                      onClick={handleClearVolunteerFilters}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>

                {/* Volunteer Hours by User */}
                <div className="space-y-4">
                  {(() => {
                    const filteredHours = volunteerHours.filter((hour) => {
                      const firstNameMatch =
                        volunteerFirstName === "" ||
                        hour.user.firstName
                          .toLowerCase()
                          .includes(volunteerFirstName.toLowerCase());
                      const lastNameMatch =
                        volunteerLastName === "" ||
                        hour.user.lastName
                          .toLowerCase()
                          .includes(volunteerLastName.toLowerCase());
                      const statusMatch =
                        volunteerStatus === "all" ||
                        hour.status === volunteerStatus;

                      let dateTimeMatch = true;
                      if (
                        appliedFromDate &&
                        appliedFromTime &&
                        appliedToDate &&
                        appliedToTime
                      ) {
                        const entryStartDate = new Date(hour.startTime);
                        const fromDateTime = new Date(
                          `${appliedFromDate}T${appliedFromTime}`
                        );
                        const toDateTime = new Date(
                          `${appliedToDate}T${appliedToTime}`
                        );
                        dateTimeMatch =
                          entryStartDate >= fromDateTime &&
                          entryStartDate < toDateTime;
                      }

                      return (
                        firstNameMatch &&
                        lastNameMatch &&
                        statusMatch &&
                        dateTimeMatch
                      );
                    });

                    const userGroups = filteredHours.reduce(
                      (acc, hour) => {
                        const userId = hour.userId;
                        if (!acc[userId]) {
                          acc[userId] = {
                            user: hour.user,
                            hours: [],
                          };
                        }
                        acc[userId].hours.push(hour);
                        return acc;
                      },
                      {} as Record<number, { user: any; hours: any[] }>
                    );

                    const sortedUsers = Object.values(userGroups).sort((a, b) =>
                      a.user.lastName.localeCompare(b.user.lastName)
                    );

                    if (sortedUsers.length === 0) {
                      return (
                        <div className="text-center py-10 text-gray-500">
                          No volunteer hours found matching the filters.
                        </div>
                      );
                    }

                    return sortedUsers.map(({ user, hours }) => {
                      const totalHours = hours.reduce((sum, hour) => {
                        const start = new Date(hour.startTime);
                        const end = new Date(hour.endTime);
                        const durationMs = end.getTime() - start.getTime();
                        const hoursDec = durationMs / (1000 * 60 * 60);
                        return sum + hoursDec;
                      }, 0);

                      return (
                        <Card key={user.email} className="overflow-hidden">
                          <CardHeader className="bg-white">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">
                                  {user.firstName} {user.lastName}
                                </CardTitle>
                                <CardDescription className="text-sm mt-1">
                                  {user.email}
                                </CardDescription>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-indigo-100 border-indigo-300 text-indigo-800"
                              >
                                Total: {totalHours.toFixed(2)} hours
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date & Time</TableHead>
                                  <TableHead>Hour(s)</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {hours
                                  .sort(
                                    (a, b) =>
                                      new Date(b.startTime).getTime() -
                                      new Date(a.startTime).getTime()
                                  )
                                  .map((hour) => {
                                    const start = new Date(hour.startTime);
                                    const end = new Date(hour.endTime);
                                    const durationMs =
                                      end.getTime() - start.getTime();
                                    const hoursDec = (
                                      durationMs /
                                      (1000 * 60 * 60)
                                    ).toFixed(2);

                                    return (
                                      <TableRow key={hour.id}>
                                        <TableCell>
                                          <div className="text-sm">
                                            <div className="font-medium">
                                              {start.toLocaleDateString(
                                                "en-US",
                                                {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                }
                                              )}
                                            </div>
                                            <div className="text-gray-600">
                                              {start.toLocaleTimeString(
                                                "en-US",
                                                {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                }
                                              )}{" "}
                                              -{" "}
                                              {end.toLocaleTimeString("en-US", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          {hoursDec}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            className={
                                              hour.status === "approved"
                                                ? "bg-green-100 text-green-800 border-green-300"
                                                : hour.status === "denied"
                                                  ? "bg-red-100 text-red-800 border-red-300"
                                                  : hour.status === "resolved"
                                                    ? "bg-purple-100 text-purple-800 border-purple-300"
                                                    : "bg-indigo-100 text-indigo-800 border-indigo-300"
                                            }
                                          >
                                            {hour.status}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </TabsContent>

              <TabsContent value="issues" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Reported Issues</CardTitle>
                    <CardDescription>
                      View, filter, and manage reported issues.
                    </CardDescription>

                    <div className="flex flex-wrap gap-4 mt-4">
                      <Select
                        onValueChange={setStatusFilter}
                        defaultValue="all"
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Search by title or reporter ID"
                        value={issueSearchTerm}
                        onChange={(e) => setIssueSearchTerm(e.target.value)}
                        className="w-[300px]"
                      />

                      <Select onValueChange={setSortBy} defaultValue="newest">
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="status">By Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-4">
                    {filteredAndSortedIssues.length === 0 ? (
                      <p className="text-muted-foreground">
                        No issues match the filters.
                      </p>
                    ) : (
                      filteredAndSortedIssues.map((issue) => (
                        <Card key={issue.id} className="p-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h3 className="text-lg font-semibold">
                                {issue.title}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {issue.description}
                              </p>
                              <p className="text-xs mt-1">
                                Reported by: {issue.reportedBy.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Created: {formatDate(issue.createdAt)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Priority: {issue.priority}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant={getStatusVariant(issue.status)}>
                                {issue.status}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    Change Status
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {["open", "in_progress", "resolved"].map(
                                    (status) => (
                                      <DropdownMenuItem
                                        key={status}
                                        onClick={() =>
                                          handleChangeStatus(issue.id, status)
                                        }
                                      >
                                        {status.charAt(0).toUpperCase() +
                                          status.slice(1)}
                                      </DropdownMenuItem>
                                    )
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
