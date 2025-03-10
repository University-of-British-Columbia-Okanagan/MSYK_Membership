// userworkshop.tsx
import React, { useState, useMemo } from "react";
import { Outlet, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import { FiSearch } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from "@/components/ui/select";
import { ShadTable, type ColumnDefinition } from "@/components/ui/ShadTable";
import { getAllRegistrations } from "~/models/workshop.server";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const registrations = await getAllRegistrations();
  return { roleUser, registrations };
}

export default function UserWorkshop() {
  const { roleUser, registrations } = useLoaderData<typeof loader>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Filtering states
  const [workshopTypeFilter, setWorkshopTypeFilter] = useState<string>("all");
  const [searchUser, setSearchUser] = useState<string>(""); // search by first/last name
  const [searchWorkshop, setSearchWorkshop] = useState<string>(""); // search by workshop name

  // Compute unique workshop types
  const workshopTypes = useMemo(() => {
    const types = new Set(registrations.map((reg: any) => reg.workshop.type));
    return ["all", ...types];
  }, [registrations]);

  // Filter registrations based on workshop type, user name, and workshop name
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg: any) => {
      const matchesType =
        workshopTypeFilter === "all" ||
        reg.workshop.type.toLowerCase() === workshopTypeFilter.toLowerCase();
      
      const matchesUser =
        searchUser === "" ||
        (reg.user.firstName &&
          reg.user.firstName.toLowerCase().includes(searchUser.toLowerCase())) ||
        (reg.user.lastName &&
          reg.user.lastName.toLowerCase().includes(searchUser.toLowerCase()));
      
      const matchesWorkshop =
        searchWorkshop === "" ||
        (reg.workshop.name &&
          reg.workshop.name.toLowerCase().includes(searchWorkshop.toLowerCase()));
      
      return matchesType && matchesUser && matchesWorkshop;
    });
  }, [registrations, workshopTypeFilter, searchUser, searchWorkshop]);

  // Define the columns for the ShadTable.
  type RegistrationRow = typeof registrations[number];
  const columns: ColumnDefinition<RegistrationRow>[] = [
    {
      header: "First Name",
      render: (reg) => reg.user.firstName,
    },
    {
      header: "Last Name",
      render: (reg) => reg.user.lastName,
    },
    {
      header: "Workshop Name",
      render: (reg) => reg.workshop.name,
    },
    {
      header: "Workshop Type",
      render: (reg) => reg.workshop.type,
    },
    {
      header: "Result",
      render: (reg) => {
        if (reg.workshop.type.toLowerCase() === "orientation") {
          return (
            <Select
              defaultValue={reg.result}
              onValueChange={(value) => {
                const formData = new FormData();
                formData.append("action", "updateRegistrationResult");
                formData.append("registrationId", reg.id.toString());
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
          );
        }
        return reg.result || "Pending";
      },
    },
    {
      header: "Registration Date",
      render: (reg) =>
        reg.date ? new Date(reg.date).toLocaleString() : "N/A",
    },
    {
      header: "Occurrence Start Time",
      render: (reg) =>
        reg.occurrence?.startDate
          ? new Date(reg.occurrence.startDate).toLocaleString()
          : "N/A",
    },
    {
      header: "Occurrence End Time",
      render: (reg) =>
        reg.occurrence?.endDate
          ? new Date(reg.occurrence.endDate).toLocaleString()
          : "N/A",
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">User Workshop Registrations</h1>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            {/* Workshop Type Filter */}
            <div className="flex items-center gap-2">
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
            {/* Search by First/Last Name */}
            <div className="flex items-center gap-2">
              <FiSearch className="text-gray-500" />
              <Input
                placeholder="Search by first or last name"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full md:w-64"
              />
            </div>
            {/* Search by Workshop Name */}
            <div className="flex items-center gap-2">
              <FiSearch className="text-gray-500" />
              <Input
                placeholder="Search by workshop name"
                value={searchWorkshop}
                onChange={(e) => setSearchWorkshop(e.target.value)}
                className="w-full md:w-64"
              />
            </div>
          </div>
          <ShadTable
            columns={columns}
            data={filteredRegistrations}
            emptyMessage="No registrations found"
          />
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
