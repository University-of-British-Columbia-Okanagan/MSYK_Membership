import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "react-router-dom";
import { getAccessLogs } from "~/models/accessLog.server";
import { SidebarProvider } from "~/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { useState } from "react";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { redirect } from "react-router-dom";

function computeUsageSessions(logs: any[]) {
  const sessions: any[] = [];
  const stacks: Record<string, Date[]> = {};
  console.log("Computing usage sessions from logs:", logs);

  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    const user = log.user?.email ?? "N/A";
    const key = `${user}__${log.equipment}`;

    if (!stacks[key]) stacks[key] = [];

    if (log.state === "enter") {
      stacks[key].push(new Date(log.createdAt));
    } else if (log.state === "exit") {
      if (stacks[key].length > 0) {
        const enterTime = stacks[key].pop()!;
        const exitTime = new Date(log.createdAt);

        const totalTime =
          (exitTime.getTime() - enterTime.getTime()) / 1000 / 60; // minutes

        sessions.push({
          user,
          equipment: log.equipment,
          inTime: enterTime,
          outTime: exitTime,
          totalTime,
        });
      }
    }
  }

  return sessions;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`Unauthorized access attempt to access logs page`, {
      userId: roleUser?.userId ?? "unknown",
      role: roleUser?.roleName ?? "none",
      url: request.url,
    });
    return redirect("/dashboard/user");
  }
  const url = new URL(request.url);

  const equipment = url.searchParams.get("equipment") || null;
  const accessCardId = url.searchParams.get("accessCardId") || null;
  const email = url.searchParams.get("email") || null;
  const startDate = url.searchParams.get("startDate") || null;
  const endDate = url.searchParams.get("endDate") || null;
  const minMinutesParam = url.searchParams.get("minMinutes");
  const minMinutes = minMinutesParam ? Number(minMinutesParam) : null;

  const { logs } = await getAccessLogs({
    page: 1,
    limit: 5000,
    equipment,
    accessCardId,
    email,
    startDate,
    endDate,
  });

  const summary = computeUsageSessions(logs);

  const filteredSummary =
    minMinutes != null && !Number.isNaN(minMinutes)
      ? summary.filter((s) => s.totalTime >= minMinutes)
      : summary;

  return json({
    summary: filteredSummary,
    filters: {
      equipment,
      accessCardId,
      email,
      startDate,
      endDate,
      minMinutes: minMinutesParam ?? "",
    },
  });
}

export default function AccessUsagePage() {
  const { summary, filters } = useLoaderData<typeof loader>() as {
    summary: any[];
    filters: {
      equipment: string | null;
      accessCardId: string | null;
      email: string | null;
      startDate: string | null;
      endDate: string | null;
      minMinutes: string | null;
    };
  };

  const [equipment, setEquipment] = useState(filters.equipment || "");
  const [accessCardId, setAccessCardId] = useState(filters.accessCardId || "");
  const [email, setEmail] = useState(filters.email || "");
  const [startDate, setStartDate] = useState(filters.startDate || "");
  const [endDate, setEndDate] = useState(filters.endDate || "");
  const [minMinutes, setMinMinutes] = useState(filters.minMinutes || "");

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        <AdminAppSidebar />
        <div className="p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Usage Summary</h1>

            <Link
              to="/dashboard/accesslogs"
              className="bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition"
            >
              Back to Access Logs
            </Link>
          </div>

          {/* Filters */}
          <form
            method="get"
            className="mb-6 p-6 bg-white rounded-xl shadow border border-gray-200 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Equipment
                </label>
                <input
                  type="text"
                  name="equipment"
                  placeholder="Search by equipment"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Access Card ID
                </label>
                <input
                  type="text"
                  name="accessCardId"
                  placeholder="Search by Access Card ID"
                  value={accessCardId}
                  onChange={(e) => setAccessCardId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  User Email
                </label>
                <input
                  type="text"
                  name="email"
                  placeholder="Search by user email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  name="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  name="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Minimum Usage (minutes)
                </label>
                <input
                  type="number"
                  name="minMinutes"
                  min={0}
                  placeholder="e.g. 30"
                  value={minMinutes}
                  onChange={(e) => setMinMinutes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <button
                type="submit"
                className="bg-indigo-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition shadow"
              >
                Apply Filters
              </button>

              <button
                type="button"
                onClick={() => {
                  setEquipment("");
                  setAccessCardId("");
                  setEmail("");
                  setStartDate("");
                  setEndDate("");
                  setMinMinutes("");

                  window.location.href = "?";
                }}
                className="bg-gray-100 text-gray-800 px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition shadow"
              >
                Clear Filters
              </button>
            </div>
          </form>
          {/* Session Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Equipment
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    In Time
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Out Time
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Total Time (min)
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {summary.map((row: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{row.user}</td>
                    <td className="px-4 py-2">{row.equipment}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {row.inTime ? new Date(row.inTime).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {row.outTime
                        ? new Date(row.outTime).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2">{row.totalTime?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
