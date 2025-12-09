import { useLoaderData } from "react-router";
import { Outlet } from "react-router-dom";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import WorkshopList from "~/components/ui/Dashboard/workshoplist";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import {
  getWorkshops,
  getUserWorkshopRegistrations,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { getPastWorkshopVisibility } from "~/models/admin.server";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/guestsidebar";
import { FiPlus } from "react-icons/fi";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();
  const pastVisibilityDays = await getPastWorkshopVisibility();

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

  return { roleUser, workshops: workshopsWithRegistration, pastVisibilityDays };
}

export default function UserDashboard() {
  const { roleUser, workshops, pastVisibilityDays } = useLoaderData<{
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
    pastVisibilityDays: number;
  }>();

  // New filtering logic based on current date and past visibility setting
  const now = new Date();
  const pastCutoffDate = new Date();
  pastCutoffDate.setDate(pastCutoffDate.getDate() - pastVisibilityDays);

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

  // Use the past visibility setting to filter past events
  const pastEvents = workshops.filter((event) => {
    // Check if all occurrences are in the past
    const allOccurrencesPast = event.occurrences.every(
      (occurrence) => new Date(occurrence.endDate) < now
    );

    // Check if any occurrence date falls within the past visibility window
    const hasRecentOccurrence = event.occurrences.some(
      (occurrence) => new Date(occurrence.startDate) >= pastCutoffDate
    );

    return allOccurrencesPast && hasRecentOccurrence;
  });

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Check if user is not logged in (guest)
  const isGuest = !roleUser || !roleUser.userId;

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {isGuest ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
        <main className="flex-grow p-6">
          {/* Mobile Header with Sidebar Trigger */}
          <div className="flex items-center gap-4 mb-6 md:hidden">
            <SidebarTrigger />
            <h1 className="text-xl font-bold">Workshops</h1>
          </div>

          {isGuest && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Account required to register for workshops.
            </div>
          )}
          {/* Add Workshop Button - Only show for admins */}
          {isAdmin && (
            <div className="flex justify-end mb-6">
              <Link to="/dashboard/addworkshop">
                <button className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition">
                  <FiPlus size={18} /> Add Workshop
                </button>
              </Link>
            </div>
          )}

          {/* Active Workshops Section */}
          {activeWorkshops.length > 0 ? (
            <WorkshopList
              title="Active Workshops"
              workshops={activeWorkshops}
              isAdmin={Boolean(isAdmin)}
            />
          ) : (
            <p className="text-gray-600 mt-4">No active workshops available.</p>
          )}

          {/* Active Orientations Section */}
          {activeOrientations.length > 0 ? (
            <WorkshopList
              title="Active Orientations"
              workshops={activeOrientations}
              isAdmin={Boolean(isAdmin)}
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
              isAdmin={Boolean(isAdmin)}
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
