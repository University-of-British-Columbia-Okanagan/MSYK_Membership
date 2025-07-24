import { useState, useMemo } from "react";
import { useLoaderData, redirect } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { getUserWorkshopRegistrationsByWorkshopId } from "~/models/workshop.server";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/AdminSidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import {
  ShadTable,
  type ColumnDefinition,
} from "~/components/ui/Dashboard/ShadTable";
import { FiSearch } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
    workshop?: { name: string; type: string };
  }>;
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { workshopId: string };
}) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || !roleUser.userId) {
    return redirect("/login");
  }
  const workshopId = Number(params.workshopId);
  const registrations = await getUserWorkshopRegistrationsByWorkshopId(
    workshopId
  );
  return { roleUser, registrations };
}

export default function WorkshopUsers() {
  const { roleUser, registrations } = useLoaderData<LoaderData>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Only one search bar for first/last name
  const [searchUser, setSearchUser] = useState("");

  // Determine the workshop name from the first registration (if available)
  const workshopName =
    registrations.length > 0 && registrations[0].workshop
      ? registrations[0].workshop.name
      : "This Workshop";

  // Filter registrations by first/last name
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const userName =
        `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
      return searchUser === "" || userName.includes(searchUser.toLowerCase());
    });
  }, [registrations, searchUser]);

  // Sort filtered registrations by user.id in ascending order
  const sortedRegistrations = useMemo(() => {
    return filteredRegistrations.slice().sort((a, b) => a.user.id - b.user.id);
  }, [filteredRegistrations]);

  // Handler for "Pass All" action – mark all filtered registrations as passed.
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

  // Define columns for the ShadTable.
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
      header: "Result",
      render: (reg) => {
        if (reg.workshop && reg.workshop.type.toLowerCase() === "orientation") {
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
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">
            Users Registered for {workshopName}
          </h1>
          <div className="flex items-center gap-2 mb-6">
            <FiSearch className="text-gray-500" />
            <Input
              placeholder="Search by first/last name"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="w-full md:w-64"
            />
            {/* "Pass All" button using ConfirmButton */}
            <ConfirmButton
              confirmTitle="Confirm Pass All"
              confirmDescription="Are you sure you want to mark all filtered registrations as passed?"
              onConfirm={handlePassAll}
              buttonLabel="Pass All"
              buttonClassName="bg-yellow-500 hover:bg-yellow-600 text-white"
            />
          </div>
          <ShadTable
            columns={columns}
            data={sortedRegistrations}
            emptyMessage="No users registered for this workshop"
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
