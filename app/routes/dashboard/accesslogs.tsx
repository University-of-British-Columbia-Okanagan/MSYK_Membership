import type { LoaderFunctionArgs } from "react-router-dom";
import { json } from "@remix-run/node";
import { getAccessLogs } from "~/models/accessLog.server";
import { Link, useLoaderData } from "react-router-dom";
import { SidebarProvider } from "~/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { useState } from "react";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { redirect } from "react-router-dom";

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

  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = 20;

  const equipment = url.searchParams.get("equipment") || null;
  const accessCardId = url.searchParams.get("accessCardId") || null;
  const email = url.searchParams.get("email") || null;
  const startDate = url.searchParams.get("startDate") || null;
  const endDate = url.searchParams.get("endDate") || null;

  const { logs, total } = await getAccessLogs({
    page,
    limit,
    equipment,
    accessCardId,
    email,
    startDate,
    endDate,
  });

  return json({
    logs,
    total,
    page,
    limit,
    filters: { equipment, accessCardId, email, startDate, endDate },
  });
}

type Filters = {
  equipment: string | null;
  accessCardId: string | null;
  email: string | null;
  startDate: string | null;
  endDate: string | null;
};

export default function AccessLogPage() {
  const { logs, total, page, limit, filters } = useLoaderData<{
    logs: any[];
    total: number;
    page: number;
    limit: number;
    filters: Filters;
  }>();

  const totalPages = Math.ceil(total / limit);
  const [equipment, setEquipment] = useState(filters.equipment || "");
  const [accessCardId, setAccessCardId] = useState(filters.accessCardId || "");
  const [email, setEmail] = useState(filters.email || "");
  const [startDate, setStartDate] = useState(filters.startDate || "");
  const [endDate, setEndDate] = useState(filters.endDate || "");

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        <AdminAppSidebar />
        <div className="p-6 w-full">
          <div className="flex items-center justify-between mb-4">
  <h1 className="text-2xl font-bold">Access Logs</h1>

  <Link
    to="/dashboard/accessusage"
    className="bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition"
  >
    View Usage Summary
  </Link>
</div>


          <form
            method="get"
            className="mb-6 p-6 bg-white rounded-xl shadow border border-gray-200 space-y-6"
          >
            {/* FIRST ROW */}
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

            {/* SECOND ROW (DATE RANGE) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>

            {/* BUTTONS */}
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
                  window.location.href = "?";
                }}
                className="bg-gray-100 text-gray-800 px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition shadow"
              >
                Clear Filters
              </button>
            </div>
          </form>

          {/* TABLE */}
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs found.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Log ID
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Equipment
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        State
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        User Email
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Access Card ID
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Timestamp
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {logs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2">{log.id}</td>
                        <td className="px-4 py-2">{log.equipment}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.state === "enter" || log.state === "exit"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {log.state}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {log.user?.email ?? "N/A"}
                        </td>
                        <td className="px-4 py-2">{log.accessCardId}</td>
                        <td className="px-4 py-2 text-gray-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex justify-between items-center mt-4">
                <a
                  href={`?page=${page - 1}`}
                  className={`px-4 py-2 rounded bg-gray-200 text-gray-700 ${
                    page <= 1 ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  Previous
                </a>

                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>

                <a
                  href={`?page=${page + 1}`}
                  className={`px-4 py-2 rounded bg-gray-200 text-gray-700 ${
                    page >= totalPages ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  Next
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
