import { useLoaderData, Form } from "react-router";
import { json, type LoaderFunction, type ActionFunction } from "@remix-run/node";

type AccessLog = {
  id: number;
  userId: number | null;
  passcodeUsed: number;
  status: string;
  createdAt: string;
};

// --- Loader: Fetch logs from existing API ---
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const baseUrl = `${url.origin}/esp32?logs=true&limit=50`;
  const response = await fetch(baseUrl);
  const data = await response.json();
  return json(data);
};

// --- Action: Handle certification update ---
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const userId = formData.get("userId");
  const payload = {
    equipmentCertified: formData.get("equipmentCertified") === "on",
    millCertified: formData.get("millCertified") === "on",
    cncCertified: formData.get("cncCertified") === "on",
    welderCertified: formData.get("welderCertified") === "on",
  };

  // Call existing esp32 API
  const response = await fetch(`${process.env.BASE_URL ?? "http://localhost:5173"}/esp32/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  return json(result);
};

// --- Page Component ---
export default function Esp32Panel() {
  const { logs } = useLoaderData<{ success: boolean; logs: AccessLog[] }>();

  return (
    <div className="p-6 space-y-8">
      {/* Logs Table */}
      <section className="bg-white shadow-md rounded-2xl p-4">
        <h2 className="text-xl font-semibold mb-4">Access Logs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Passcode</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs?.length ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="px-4 py-2">{log.id}</td>
                    <td className="px-4 py-2">{log.userId ?? "—"}</td>
                    <td className="px-4 py-2">{log.passcodeUsed}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          log.status === "granted"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center p-4 text-gray-500">
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Certification Update Form */}
      <section className="bg-white shadow-md rounded-2xl p-4">
        <h2 className="text-xl font-semibold mb-4">Update Certifications</h2>
        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium">User ID</label>
            <input
              type="number"
              name="userId"
              required
              className="border rounded-lg px-3 py-2 w-32"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="equipmentCertified" defaultChecked />
              <span>Equipment Certified</span>
            </label>

            <label className="flex items-center space-x-2">
              <input type="checkbox" name="millCertified" defaultChecked />
              <span>Mill Certified</span>
            </label>

            <label className="flex items-center space-x-2">
              <input type="checkbox" name="cncCertified" defaultChecked />
              <span>CNC Certified</span>
            </label>

            <label className="flex items-center space-x-2">
              <input type="checkbox" name="welderCertified" defaultChecked />
              <span>Welder Certified</span>
            </label>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition"
          >
            Update Certifications
          </button>
        </Form>
      </section>
    </div>
  );
}
