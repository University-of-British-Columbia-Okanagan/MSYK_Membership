import { useState, useMemo } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
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
  SelectItem,
} from "@/components/ui/select";
import {
  ShadTable,
  type ColumnDefinition,
} from "~/components/ui/Dashboard/ShadTable";
import { getAllRegistrations } from "~/models/workshop.server";
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";

interface LoaderData {
  roleUser: {
    roleId: number;
    roleName: string;
    userId: number;
  };
  registrations: Array<{
    id: number;
    result: string;
    date: string | Date;
    user: { id: number; firstName: string; lastName: string };
    occurrence: { startDate: string; endDate: string } | null;
    workshop: { name: string; type: string };
  }>;
}

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const registrations = await getAllRegistrations();
  return { roleUser, registrations };
}

export default function AllUserWorkshop() {
  const { roleUser, registrations } = useLoaderData<LoaderData>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Filtering states
  const [workshopTypeFilter, setWorkshopTypeFilter] = useState<string>("all");
  const [searchUser, setSearchUser] = useState<string>(""); // Filter by first/last name
  const [searchWorkshop, setSearchWorkshop] = useState<string>(""); // Filter by workshop name

  // Compute unique workshop types from registrations
  const workshopTypes = useMemo(() => {
    const types = new Set(registrations.map((reg) => reg.workshop.type));
    return ["all", ...types];
  }, [registrations]);

  // Filter registrations based on workshop type, user name, and workshop name
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const matchesType =
        workshopTypeFilter === "all" ||
        reg.workshop.type.toLowerCase() === workshopTypeFilter.toLowerCase();
      const matchesUser =
        searchUser === "" ||
        (reg.user.firstName &&
          reg.user.firstName
            .toLowerCase()
            .includes(searchUser.toLowerCase())) ||
        (reg.user.lastName &&
          reg.user.lastName.toLowerCase().includes(searchUser.toLowerCase()));
      const matchesWorkshop =
        searchWorkshop === "" ||
        (reg.workshop.name &&
          reg.workshop.name
            .toLowerCase()
            .includes(searchWorkshop.toLowerCase()));
      return matchesType && matchesUser && matchesWorkshop;
    });
  }, [registrations, workshopTypeFilter, searchUser, searchWorkshop]);

  // Sort the filtered registrations by user.id in ascending order
  const sortedRegistrations = useMemo(() => {
    return filteredRegistrations.slice().sort((a, b) => a.user.id - b.user.id);
  }, [filteredRegistrations]);

  // "Pass All" action handler – marks all filtered registrations as passed.
  const handlePassAll = async () => {
    const registrationIds = sortedRegistrations.map((reg) => reg.id);
    if (registrationIds.length === 0) return;
    const formData = new FormData();
    formData.append("action", "passAll");
    formData.append("registrationIds", JSON.stringify(registrationIds));
    await fetch("/dashboard/admin", {
      method: "POST",
      body: formData,
    });
    window.location.reload();
  };

  // Define columns for the ShadTable
  type RegistrationRow = LoaderData["registrations"][number];
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
      render: (reg) => (reg.date ? new Date(reg.date).toLocaleString() : "N/A"),
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
      <div className="absolute inset-0 flex">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">
            User Workshop Registrations
          </h1>
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
            {/* "Pass All" button */}
            <ConfirmButton
              confirmTitle="Confirm Pass All"
              confirmDescription="Are you sure you want to mark all filtered registrations as passed?"
              onConfirm={handlePassAll}
              buttonLabel="Pass All"
              buttonClassName="bg-indigo-500 hover:bg-indigo-600 text-white"
            />
          </div>
          <ShadTable
            columns={columns}
            data={sortedRegistrations}
            emptyMessage="No registrations found"
          />
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
