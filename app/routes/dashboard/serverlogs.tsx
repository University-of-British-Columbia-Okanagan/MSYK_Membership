import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "react-router-dom";
import fs from "fs/promises";
import path from "path";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { SidebarProvider } from "~/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import { getRoleUser } from "~/utils/session.server";
export type LoaderData = {
  logs: string;
};
export async function loader({ request }: { request: Request }) {
    const roleUser = await getRoleUser(request);
    if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
      throw new Response("Not Authorized", { status: 419 });
    }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.toLowerCase() || "";
  const levels = url.searchParams.getAll("level"); // e.g., ['info', 'error']
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const logPath = path.resolve("logs/all_logs.log");

  try {
    let content = await fs.readFile(logPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    const filtered = lines.filter((line) => {
      try {
        const log = JSON.parse(line);
        const logTime = new Date(log.timestamp).getTime();

        const matchesLevel = levels.length === 0 || levels.includes(log.level);
        const matchesQuery = query === "" || line.toLowerCase().includes(query);

        const matchesStart = !start || logTime >= new Date(start).getTime();
        const matchesEnd = !end || logTime <= new Date(end).getTime();

        return matchesLevel && matchesQuery && matchesStart && matchesEnd;
      } catch {
        return false;
      }
    });

    return json({ logs: filtered.slice(-200).join("\n") }); // limit to last 200 lines
  } catch (err) {
    return json({ logs: "Failed to load logs." }, { status: 500 });
  }
}

export default function LogsTab() {
  const { logs } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [start, setStart] = useState(searchParams.get("start") || "");
  const [end, setEnd] = useState(searchParams.get("end") || "");

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [levels, setLevels] = useState<string[]>(
    searchParams.getAll("level") || []
  );
  function updateParams() {
    const newParams = new URLSearchParams();
    if (query) newParams.set("q", query);
    if (start) newParams.set("start", start);
    if (end) newParams.set("end", end);
    levels.forEach((lvl) => newParams.append("level", lvl));
    setSearchParams(newParams);
  }

  function toggleLevel(level: string) {
    setLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  useEffect(() => {
    const delay = setTimeout(updateParams, 300);
    return () => clearTimeout(delay);
  }, [query, levels, start, end]); // ✅ Now updates when date range changes

  return (
    <SidebarProvider>
      <AdminAppSidebar />
      <Card>
        <CardHeader>
          <CardTitle>Server Logs</CardTitle>
          <CardDescription>View server logs here.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search Box */}
            <Input
              type="text"
              placeholder="Search logs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-[300px]"
            />

            {/* Multi-Checkbox */}
            <div className="flex gap-4 items-center">
              {["info", "warn", "error"].map((level) => (
                <label key={level} className="flex items-center space-x-2">
                  <Checkbox
                    checked={levels.includes(level)}
                    onCheckedChange={() => toggleLevel(level)}
                  />
                  <span className="capitalize">{level}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm text-muted-foreground">Start</label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-[220px]"
              />
              <label className="text-sm text-muted-foreground">End</label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-[220px]"
              />
            </div>

            {/* (Optional) Date range filter goes here */}
            {/* Use react-datepicker or another lib if desired */}
          </div>

          {/* Log Output */}
          <div className="space-y-1 font-mono text-sm max-h-[600px] overflow-auto">
            {logs
              .split("\n")
              .filter(Boolean)
              .map((line, i) => {
                try {
                  const log = JSON.parse(line);
                  const time = new Date(log.timestamp).toLocaleString();
                  const level = log.level?.toUpperCase() ?? "INFO";

                  let color = "text-green-400";
                  if (level === "WARN") color = "text-yellow-400";
                  if (level === "ERROR") color = "text-red-400";

                  return (
                    <div
                      key={i}
                      className="flex gap-2 whitespace-pre-wrap break-words"
                    >
                      <span className={`font-bold ${color}`}>[{level}]</span>
                      <span className="text-muted-foreground">{time}</span>
                      <span>
                        {typeof log.message === "object"
                          ? JSON.stringify(log.message)
                          : log.message}
                      </span>
                      {log.url && (
                        <a
                          href={log.url}
                          className="underline text-blue-400"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {log.url}
                        </a>
                      )}
                    </div>
                  );
                } catch {
                  // Fallback if line isn't valid JSON
                  return (
                    <div key={i} className="text-gray-400">
                      {line}
                    </div>
                  );
                }
              })}
          </div>
        </CardContent>
      </Card>
    </SidebarProvider>
  );
}
