import { useState, useMemo } from "react";
import { useLoaderData, redirect, useParams, Link } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import {
  getUserWorkshopRegistrationsByWorkshopId,
  getWorkshopById,
} from "~/models/workshop.server";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Registration {
  id: number;
  result: string;
  status: string;
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

  // Check if user is logged in
  if (!roleUser || !roleUser.userId) {
    return redirect("/login");
  }

  // Check if user is admin
  if (roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }

  const workshopId = Number(params.workshopId);

  // Check if workshop exists
  try {
    const workshop = await getWorkshopById(workshopId);
    if (!workshop) {
      return redirect("/dashboard/admin");
    }
  } catch (error) {
    // Workshop doesn't exist, redirect to admin dashboard
    return redirect("/dashboard/admin");
  }

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
  const [resultFilter, setResultFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    "lastName" | "firstName" | "occurrenceDate" | "registrationDate"
  >("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  // Determine a group's effective result for filtering purposes
  const getGroupEffectiveResult = (group: GroupedRegistration): string => {
    const results = group.registrations.map((r) => r.result);
    if (results.every((r) => r === "cancelled")) return "cancelled";
    const nonCancelled = results.filter((r) => r !== "cancelled");
    if (nonCancelled.length === 0) return "cancelled";
    if (nonCancelled.some((r) => r === "failed")) return "failed";
    if (nonCancelled.every((r) => r === "passed")) return "passed";
    return "pending";
  };

  // Filter by user name, result, and occurrence date
  const filteredGroups = useMemo(() => {
    return groupedRegistrations.filter((group) => {
      const userName =
        `${group.userFirstName} ${group.userLastName}`.toLowerCase();
      if (searchUser !== "" && !userName.includes(searchUser.toLowerCase()))
        return false;

      if (resultFilter !== "all") {
        if (getGroupEffectiveResult(group) !== resultFilter) return false;
      }

      if (dateFilter) {
        const hasMatchingDate = group.registrations.some((reg) => {
          const d = new Date(reg.occurrence.startDate);
          const occDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return occDateStr === dateFilter;
        });
        if (!hasMatchingDate) return false;
      }

      return true;
    });
  }, [groupedRegistrations, searchUser, resultFilter, dateFilter]);

  // Sort by selected field and direction
  const sortedGroups = useMemo(() => {
    return filteredGroups.slice().sort((a, b) => {
      let cmp = 0;
      if (sortBy === "occurrenceDate") {
        cmp =
          new Date(a.registrations[0].occurrence.startDate).getTime() -
          new Date(b.registrations[0].occurrence.startDate).getTime();
      } else if (sortBy === "registrationDate") {
        cmp =
          new Date(a.registrations[0].date as string).getTime() -
          new Date(b.registrations[0].date as string).getTime();
      } else if (sortBy === "firstName") {
        cmp =
          a.userFirstName.localeCompare(b.userFirstName) ||
          a.userLastName.localeCompare(b.userLastName);
      } else {
        // lastName (default)
        cmp =
          a.userLastName.localeCompare(b.userLastName) ||
          a.userFirstName.localeCompare(b.userFirstName);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredGroups, sortBy, sortDir]);

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
    // Only pass registrations that have status "pending"
    const registrationIds = sortedGroups.flatMap((group) =>
      group.registrations
        .filter((reg) => reg.result === "pending")
        .map((reg) => reg.id)
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ConfirmButton
                      confirmTitle="Confirm Pass All"
                      confirmDescription="Are you sure you want to mark all filtered registrations as passed?"
                      onConfirm={handlePassAll}
                      buttonLabel="Pass All"
                      buttonClassName="bg-indigo-500 hover:bg-indigo-600 text-white"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Passes all users with status "pending"</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Filter / Sort Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Result filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap">
                Result:
              </span>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date filter (occurrence date) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap">
                Date:
              </span>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40"
              />
              {dateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateFilter("")}
                  className="h-8 px-2 text-gray-500"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap">
                Sort:
              </span>
              <Select
                value={sortBy}
                onValueChange={(v) =>
                  setSortBy(
                    v as "lastName" | "firstName" | "occurrenceDate" | "registrationDate"
                  )
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastName">Last Name (A–Z)</SelectItem>
                  <SelectItem value="firstName">First Name (A–Z)</SelectItem>
                  <SelectItem value="registrationDate">
                    Registration Date
                  </SelectItem>
                  <SelectItem value="occurrenceDate">
                    Occurrence Date(s)
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
                className="h-8 px-2 text-gray-500"
              >
                {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
              </Button>
            </div>

            {/* Clear all filters */}
            {(resultFilter !== "all" || dateFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResultFilter("all");
                  setDateFilter("");
                }}
                className="h-8 text-gray-500"
              >
                Clear filters
              </Button>
            )}
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
                    Occurrence Date(s)
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
                      {groupedRegistrations.length === 0
                        ? "No users registered for this workshop"
                        : "No users match the current filters"}
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
                          {firstReg.status === "Cancelled" ||
                          firstReg.result === "cancelled" ? (
                            <span className="text-gray-500">Cancelled</span>
                          ) : isOrientation ? (
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
