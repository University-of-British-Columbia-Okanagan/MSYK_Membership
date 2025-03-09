import React, { useState, useMemo } from "react";
import { Outlet, Link, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  getWorkshops,
  deleteWorkshop,
  duplicateWorkshop,
  getAllRegistrations,
  updateRegistrationResult,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import { FiPlus, FiSearch } from "react-icons/fi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();
  const registrations = await getAllRegistrations();

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user"); // Redirect non-admins to User Dashboard
  }

  return { roleUser, workshops, registrations };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const workshopId = formData.get("workshopId");

  if (action === "edit") {
    return redirect(`/editworkshop/${workshopId}`);
  }

  if (action === "delete") {
    try {
      await deleteWorkshop(Number(workshopId));
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error deleting workshop:", error);
      return { error: "Failed to delete workshop" };
    }
  }

  if (action === "duplicate") {
    try {
      await duplicateWorkshop(Number(workshopId));
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error duplicating workshop:", error);
      return { error: "Failed to duplicate workshop" };
    }
  }

  if (action === "updateRegistrationResult") {
    const registrationId = formData.get("registrationId");
    const newResult = formData.get("newResult");
    if (registrationId && newResult) {
      try {
        await updateRegistrationResult(
          Number(registrationId),
          String(newResult)
        );
        return redirect("/dashboard/admin");
      } catch (error) {
        console.error("Error updating registration result:", error);
        return { error: "Failed to update registration result" };
      }
    }
  }

  return null;
}

export default function AdminDashboard() {
  const { workshops, registrations } = useLoaderData() as {
    workshops: any[];
    registrations: {
      id: number;
      result: string;
      date: string | Date;
      user: { firstName: string; lastName: string };
      workshop: { name: string; type: string };
      occurrence: { startDate: string | Date; endDate: string | Date };
    }[];
  };

  // State for filters
  const [workshopTypeFilter, setWorkshopTypeFilter] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");

  // Get unique workshop types
  const workshopTypes = useMemo(() => {
    const types = new Set(registrations.map((reg) => reg.workshop.type));
    return ["all", ...types];
  }, [registrations]);

  // Filter registrations based on workshop type and search name
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      // Workshop type filter
      const matchesType =
        workshopTypeFilter === "all" ||
        reg.workshop.type.toLowerCase() === workshopTypeFilter.toLowerCase();

      // Name search filter (case-insensitive, matches first or last name)
      const matchesName =
        searchName === "" ||
        reg.user.firstName.toLowerCase().includes(searchName.toLowerCase()) ||
        reg.user.lastName.toLowerCase().includes(searchName.toLowerCase());

      return matchesType && matchesName;
    });
  }, [registrations, workshopTypeFilter, searchName]);

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <div className="flex justify-end mb-6 pr-4">
            <Link to="/addworkshop">
              <button className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                <FiPlus size={18} /> Add Workshop
              </button>
            </Link>
          </div>

          <WorkshopList title="Workshops" workshops={workshops} isAdmin={true} />

          <div className="p-6">
            <h2 className="text-3xl font-bold mt-8 mb-4">
              Users Registered in a Workshop
            </h2>

            {/* Filtering Section */}
            <div className="flex space-x-4 mb-4 items-center">
              {/* Workshop Type Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  Workshop Type:
                </label>
                <Select
                  value={workshopTypeFilter}
                  onValueChange={setWorkshopTypeFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select workshop type" />
                  </SelectTrigger>
                  <SelectContent>
                    {workshopTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === "all"
                          ? "All Types"
                          : type === "orientation"
                          ? "Orientation"
                          : type === "workshop"
                          ? "Workshop"
                          : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name Search */}
              <div className="flex items-center space-x-2">
                <FiSearch className="text-gray-500" />
                <Input
                  placeholder="Search by first or last name"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <Table className="w-full mb-8">
              <TableHeader>
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Workshop Name</TableHead>
                  <TableHead>Workshop Type</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-500"
                    >
                      No registrations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>{reg.user.firstName}</TableCell>
                      <TableCell>{reg.user.lastName}</TableCell>
                      <TableCell>{reg.workshop.name}</TableCell>
                      <TableCell>{reg.workshop.type}</TableCell>
                      <TableCell>
                        {reg.workshop.type.toLowerCase() === "orientation" ? (
                          <Select
                            defaultValue={reg.result}
                            onValueChange={(value) => {
                              // When the admin selects a new result, submit the update.
                              const formData = new FormData();
                              formData.append(
                                "action",
                                "updateRegistrationResult"
                              );
                              formData.append(
                                "registrationId",
                                reg.id.toString()
                              );
                              formData.append("newResult", value);
                              fetch("/dashboard/admin", {
                                method: "POST",
                                body: formData,
                              }).then(() => window.location.reload());
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Select result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="passed">Passed</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          reg.result
                        )}
                      </TableCell>
                      <TableCell>
                        {reg.date ? new Date(reg.date).toLocaleString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        {reg.occurrence?.startDate
                          ? new Date(reg.occurrence.startDate).toLocaleString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {reg.occurrence?.endDate
                          ? new Date(reg.occurrence.endDate).toLocaleString()
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
