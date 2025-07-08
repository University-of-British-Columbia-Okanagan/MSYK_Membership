// workshops.tsx
import { useLoaderData } from "react-router";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  getWorkshops,
  getUserWorkshopRegistrations,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "@/components/ui/Dashboard/guestsidebar";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();

  // First, attach a default isRegistered property (false) for every workshop.
  let workshopsWithRegistration = workshops.map((workshop) => ({
    ...workshop,
    isRegistered: false,
  }));

  // If a user is logged in, update each workshop's isRegistered flag
  if (roleUser && roleUser.userId) {
    const registrations = await getUserWorkshopRegistrations(roleUser.userId);
    const registeredOccurrenceIds = new Set(
      registrations.map((reg) => reg.occurrenceId)
    );

    workshopsWithRegistration = workshops.map((workshop) => ({
      ...workshop,
      // Mark as registered if any occurrence id is in the user's registered occurrences (at least one)
      isRegistered: workshop.occurrences.some((occurrence) =>
        registeredOccurrenceIds.has(occurrence.id)
      ),
    }));
  }

  return { roleUser, workshops: workshopsWithRegistration };
}

export default function UserDashboard() {
  const { roleUser, workshops } = useLoaderData<{
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    } | null;
    workshops: {
      id: number;
      name: string;
      description: string;
      price: number;
      type: string;
      occurrences: { id: number; startDate: string; endDate: string }[];
      isRegistered: boolean;
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

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Check if user is not logged in (guest)
  const isGuest = !roleUser || !roleUser.userId;

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isGuest ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
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
            <p className="text-gray-600 mt-4">No active workshops available.</p>
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
            <p className="text-gray-600 mt-4">No past events available.</p>
          )}

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
