import type { LoaderFunctionArgs } from "react-router-dom";
import { json } from "@remix-run/node";
import { getAccessLogs } from "~/models/accessLog.server";
import { useLoaderData } from "react-router-dom";
import { SidebarProvider } from "~/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";

export async function loader({ request }: LoaderFunctionArgs) {
  const logs = await getAccessLogs();
  return json({ logs });
}

export default function AccessLogPage() {
  const { logs } = useLoaderData<typeof loader>();

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        <AdminAppSidebar />
        <div className="p-6 w-full">
          <h1 className="text-2xl font-bold mb-4">Access Logs</h1>

          {logs.length === 0 ? (
            <p className="text-gray-500">No logs available.</p>
          ) : (
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
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {log.id}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {log.equipment}
                      </td>
                      <td className="px-4 py-2 text-sm">
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
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {log.user?.email || "N/A"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {log.accessCardId}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
