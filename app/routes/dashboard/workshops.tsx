// workshops.tsx

import { useLoaderData } from "react-router";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();
  return { workshops };
}

export default function UserDashboard() {
  const { workshops } = useLoaderData<{
    workshops: {
      id: number;
      name: string;
      description: string;
      price: number;
      type: string;
      occurrences: { id: number; startDate: string; endDate: string }[];
    }[];
  }>();

  const now = new Date();

  const activeWorkshops = workshops.filter(
    (event) =>
      event.type === "workshop" &&
      event.occurrences.some(
        (occurrence) => new Date(occurrence.endDate) >= now
      )
  );

  const activeOrientations = workshops.filter(
    (event) =>
      event.type === "orientation" &&
      event.occurrences.some(
        (occurrence) => new Date(occurrence.endDate) >= now
      )
  );

  const pastEvents = workshops.filter((event) =>
    event.occurrences.every((occurrence) => new Date(occurrence.endDate) < now)
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">All Workshops</h1>

          {/* Active Workshops Section */}
          {activeWorkshops.length > 0 ? (
            <WorkshopList
              title="Active Workshops"
              workshops={activeWorkshops}
              isAdmin={false}
            />
          ) : (
            <p className="text-gray-600 mt-4">
              No active workshops available.
            </p>
          )}

          {/* Active Orientations Section */}
          {activeOrientations.length > 0 ? (
            <WorkshopList
              title="Active Orientations"
              workshops={activeOrientations}
              isAdmin={false}
            />
          ) : (
            <p className="text-gray-600 mt-4">
              No active orientations available.
            </p>
          )}

          {/* Past Events Section */}
          {pastEvents.length > 0 ? (
            <WorkshopList
              title="Past Events"
              workshops={pastEvents}
              isAdmin={false}
            />
          ) : (
            <p className="text-gray-600 mt-4">
              No past events available.
            </p>
          )}

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
