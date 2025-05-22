import React, { useState } from "react";
import { useLoaderData, redirect } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FiSearch } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import {
  format,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
} from "date-fns";

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

export async function loader({ request }: { request: Request }) {
  // Check if user is admin
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }

  // Load all workshops with their occurrences
  const workshops = await getWorkshops();

  // Return data to the component
  return {
    roleUser,
    workshops,
  };
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
  const { roleUser, workshops } = useLoaderData<{
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
  }>();

  const [searchTerm, setSearchTerm] = useState("");

  // Filter workshops based on search term
  const filteredWorkshops = workshops.filter((workshop) =>
    workshop.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AdminAppSidebar />
        <main className="flex-grow p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="h-6 w-6 text-yellow-500" />
              <h1 className="text-2xl font-bold">Admin Reports</h1>
            </div>

            <Tabs defaultValue="workshops" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="workshops">Workshop Reports</TabsTrigger>
                {/* Additional report tabs can be added here */}
                <TabsTrigger value="placeholder">Equipment Reports</TabsTrigger>
                <TabsTrigger value="placeholder2">User Reports</TabsTrigger>
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
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
