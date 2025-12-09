import { useState, useMemo } from "react";
import { useLoaderData, redirect, useParams, Link } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { getUserWorkshopRegistrationsByWorkshopId } from "~/models/workshop.server";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import { FiSearch, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";
import { Button } from "@/components/ui/button";

interface Registration {
  id: number;
  result: string;
  date: string | Date;
  user: { id: number; firstName: string; lastName: string; email: string };
  occurrence: {
    id: number;
    startDate: string;
    endDate: string;
    connectId: number | null;
  };
  workshop?: { name: string; type: string };
  priceVariation?: { id: number; name: string; price: number } | null;
}

interface LoaderData {
  roleUser: {
    roleId: number;
    roleName: string;
    userId: number;
  };
  registrations: Registration[];
}

interface GroupedRegistration {
  userId: number;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  connectId: number | null;
  isMultiDay: boolean;
  registrations: Registration[];
  allPassed: boolean;
  currentResult: string;
  priceVariation?: { id: number; name: string; price: number } | null;
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
  const registrations =
    await getUserWorkshopRegistrationsByWorkshopId(workshopId);
  return { roleUser, registrations };
}

export default function WorkshopUsers() {
  const { roleUser, registrations } = useLoaderData<LoaderData>();
  const { workshopId } = useParams();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  const [searchUser, setSearchUser] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Determine the workshop name and type
  const workshopName =
    registrations.length > 0 && registrations[0].workshop
      ? registrations[0].workshop.name
      : "This Workshop";

  const workshopType =
    registrations.length > 0 && registrations[0].workshop
      ? registrations[0].workshop.type
      : "";

  const isOrientation = workshopType.toLowerCase() === "orientation";

  // Group registrations by user and connectId
  const groupedRegistrations = useMemo(() => {
    const groups = new Map<string, GroupedRegistration>();

    registrations.forEach((reg) => {
      const connectId = reg.occurrence.connectId;
      const key = `${reg.user.id}-${connectId || reg.occurrence.id}`;

      if (!groups.has(key)) {
        const isMultiDay = connectId !== null;
        groups.set(key, {
          userId: reg.user.id,
          userFirstName: reg.user.firstName,
          userLastName: reg.user.lastName,
          userEmail: reg.user.email,
          connectId: connectId,
          isMultiDay: isMultiDay,
          registrations: [],
          allPassed: true,
          currentResult: reg.result,
          priceVariation: reg.priceVariation,
        });
      }

      const group = groups.get(key)!;
      group.registrations.push(reg);

      // Check if all registrations in group are passed
      if (reg.result !== "passed") {
        group.allPassed = false;
      }
    });

    return Array.from(groups.values());
  }, [registrations]);

  // Filter by user name
  const filteredGroups = useMemo(() => {
    return groupedRegistrations.filter((group) => {
      const userName =
        `${group.userFirstName} ${group.userLastName}`.toLowerCase();
      return searchUser === "" || userName.includes(searchUser.toLowerCase());
    });
  }, [groupedRegistrations, searchUser]);

  // Sort by user ID
  const sortedGroups = useMemo(() => {
    return filteredGroups.slice().sort((a, b) => a.userId - b.userId);
  }, [filteredGroups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handlePassAll = async () => {
    const registrationIds = sortedGroups.flatMap((group) =>
      group.registrations.map((reg) => reg.id)
    );
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

  const handleUpdateGroupResult = async (
    group: GroupedRegistration,
    newResult: string
  ) => {
    // Get all registration IDs in the group
    const registrationIds = group.registrations.map((reg) => reg.id);

    const formData = new FormData();
    formData.append("action", "updateMultipleResults");
    formData.append("registrationIds", JSON.stringify(registrationIds));
    formData.append("newResult", newResult);

    await fetch("/dashboard/admin", {
      method: "POST",
      body: formData,
    });
    window.location.reload();
  };

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6 overflow-auto">
          {/* Mobile Header with Sidebar Trigger */}
          <div className="flex items-center gap-4 mb-6 md:hidden">
            <SidebarTrigger />
            <h1 className="text-xl font-bold">Workshop Users</h1>
          </div>

          {/* Back to Workshop Button */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() =>
                (window.location.href = `/dashboard/workshops/${workshopId}`)
              }
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Workshop
            </Button>
          </div>

          <h1 className="text-2xl font-bold mb-4 hidden md:block">
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
            <ConfirmButton
              confirmTitle="Confirm Pass All"
              confirmDescription="Are you sure you want to mark all filtered registrations as passed?"
              onConfirm={handlePassAll}
              buttonLabel="Pass All"
              buttonClassName="bg-indigo-500 hover:bg-indigo-600 text-white"
            />
          </div>

          {/* Grouped Registrations Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    First Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Last Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Price Variation
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Result
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Registration Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Dates
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No users registered for this workshop
                    </td>
                  </tr>
                ) : (
                  sortedGroups.map((group) => {
                    const groupKey = `${group.userId}-${group.connectId || group.registrations[0].occurrence.id}`;
                    const isExpanded = expandedGroups.has(groupKey);
                    const firstReg = group.registrations[0];

                    return (
                      <tr key={groupKey} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {group.isMultiDay && (
                              <button
                                onClick={() => toggleGroup(groupKey)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {isExpanded ? (
                                  <FiChevronDown size={16} />
                                ) : (
                                  <FiChevronRight size={16} />
                                )}
                              </button>
                            )}
                            <span>{group.userFirstName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{group.userLastName}</td>
                        <td className="px-4 py-3 text-sm">{group.userEmail}</td>
                        <td className="px-4 py-3">
                          {group.priceVariation
                            ? `${group.priceVariation.name} ($${group.priceVariation.price})`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          {isOrientation ? (
                            <div className="flex items-center gap-2">
                              <Select
                                defaultValue={firstReg.result}
                                onValueChange={(value) =>
                                  handleUpdateGroupResult(group, value)
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select result" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="passed">Passed</SelectItem>
                                  <SelectItem value="failed">Failed</SelectItem>
                                  <SelectItem value="pending">
                                    Pending
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {group.isMultiDay && (
                                <span className="text-xs text-gray-500">
                                  ({group.registrations.length} dates)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{firstReg.result || "Pending"}</span>
                              {group.isMultiDay && (
                                <span className="text-xs text-gray-500">
                                  ({group.registrations.length} dates)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {firstReg.date
                            ? new Date(firstReg.date).toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          {group.isMultiDay ? (
                            <div className="text-sm">
                              <div>
                                {new Date(
                                  group.registrations[0].occurrence.startDate
                                ).toLocaleDateString()}{" "}
                                -{" "}
                                {new Date(
                                  group.registrations[
                                    group.registrations.length - 1
                                  ].occurrence.endDate
                                ).toLocaleDateString()}
                              </div>
                              {isExpanded && (
                                <div className="mt-2 space-y-1 text-xs text-gray-600 pl-4 border-l-2 border-gray-200">
                                  {group.registrations.map((reg, idx) => (
                                    <div key={reg.id}>
                                      Day {idx + 1}:{" "}
                                      {new Date(
                                        reg.occurrence.startDate
                                      ).toLocaleString()}{" "}
                                      -{" "}
                                      {new Date(
                                        reg.occurrence.endDate
                                      ).toLocaleString()}
                                      <span
                                        className={`ml-2 px-1 rounded ${
                                          reg.result === "passed"
                                            ? "bg-green-100 text-green-800"
                                            : reg.result === "failed"
                                              ? "bg-red-100 text-red-800"
                                              : "bg-yellow-100 text-yellow-800"
                                        }`}
                                      >
                                        {reg.result}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm">
                              {new Date(
                                firstReg.occurrence.startDate
                              ).toLocaleString()}{" "}
                              -{" "}
                              {new Date(
                                firstReg.occurrence.endDate
                              ).toLocaleString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
