import { Outlet, redirect } from "react-router-dom";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/Guestsidebar";
import WorkshopList from "~/components/ui/Dashboard/Workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getWorkshops } from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { getPastWorkshopVisibility } from "~/models/admin.server";
import { getUserWorkshopRegistrations } from "~/models/workshop.server";
import { Link } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import { useLoaderData } from "react-router";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);

  // Authentication check - only allow signed-in users (admins or regular users)
  if (!roleUser) {
    throw redirect("/login");
  }

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

  return {
    workshops: workshopsWithRegistration,
    roleUser,
    pastVisibilityDays,
  };
}

export default function UserDashboard() {
  const { workshops, roleUser, pastVisibilityDays } = useLoaderData<{
    workshops: {
      id: number;
      name: string;
      description: string;
      price: number;
      type: string;
      occurrences: { id: number; startDate: string; endDate: string }[];
      isRegistered: boolean;
    }[];
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    };
    pastVisibilityDays: number;
  }>();

  // Determine user role
  const isAdmin = roleUser && roleUser.roleName?.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

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
          {/* Add Workshop Button - Only show for admins */}
          {isAdmin && (
            <div className="flex justify-end mb-6 pr-4">
              <Link to="/dashboard/addworkshop">
                <button className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                  <FiPlus size={18} /> Add Workshop
                </button>
              </Link>
            </div>
          )}

          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

          {/* Active Workshops Section */}
          {activeWorkshops.length > 0 ? (
            <WorkshopList
              title="Active Workshops"
              workshops={activeWorkshops}
              isAdmin={isAdmin}
            />
          ) : (
            <p className="text-gray-600 mt-4">No active workshops available.</p>
          )}

          {/* Active Orientations Section */}
          {activeOrientations.length > 0 ? (
            <WorkshopList
              title="Active Orientations"
              workshops={activeOrientations}
              isAdmin={isAdmin}
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
              isAdmin={isAdmin}
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
