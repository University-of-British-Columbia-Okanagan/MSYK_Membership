import { Outlet, Link, redirect } from "react-router-dom";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/Guestsidebar";
import WorkshopList from "~/components/ui/Dashboard/Workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  getWorkshops,
  deleteWorkshop,
  duplicateWorkshop,
  getAllRegistrations,
  updateRegistrationResult,
  getUserWorkshopRegistrations,
  updateMultipleRegistrations,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import { FiPlus } from "react-icons/fi";
import { logger } from "~/logging/logger";
import { getPastWorkshopVisibility } from "~/models/admin.server";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();
  const registrations = await getAllRegistrations();
  const pastVisibilityDays = await getPastWorkshopVisibility();

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(
      `[User: ${roleUser?.userId}] Not authorized to access admin dashboard`,
      { url: request.url }
    );
    return redirect("/dashboard/user");
  }

  let workshopsWithRegistration = workshops.map((workshop) => ({
    ...workshop,
    isRegistered: false,
  }));

  if (roleUser && roleUser.userId) {
    const adminRegistrations = await getUserWorkshopRegistrations(
      roleUser.userId
    );
    const registeredOccurrenceIds = new Set(
      adminRegistrations.map((reg) => reg.occurrenceId)
    );

    workshopsWithRegistration = workshops.map((workshop) => ({
      ...workshop,
      isRegistered: workshop.occurrences.some((occurrence) =>
        registeredOccurrenceIds.has(occurrence.id)
      ),
    }));
  }

  logger.info(`[User: ${roleUser?.userId}] Fetched admin dashboard`, {
    url: request.url,
  });
  return {
    roleUser,
    workshops: workshopsWithRegistration,
    registrations,
    pastVisibilityDays,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const workshopId = formData.get("workshopId");
  const roleUser = await getRoleUser(request);

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(
      `[User: ${roleUser?.userId}] Not authorized to access admin dashboard`,
      { url: request.url }
    );
    throw new Response("Not Authorized", { status: 419 });
  }

  if (action === "edit") {
    return redirect(`/dashboard/editworkshop/${workshopId}`);
  }

  if (action === "delete") {
    try {
      await deleteWorkshop(Number(workshopId));
      logger.info(
        `[User: ${roleUser?.userId}] Deleted workshop ${workshopId} successfully`,
        { url: request.url }
      );
      return redirect("/dashboard/admin");
    } catch (error) {
      logger.error(`Error deleting workshop: ${error}`, { url: request.url });
      return { error: "Failed to delete workshop" };
    }
  }

  if (action === "duplicate") {
    try {
      await duplicateWorkshop(Number(workshopId));
      logger.info(
        `[User: ${roleUser?.userId}] Duplicated workshop ${workshopId} successfully`,
        { url: request.url }
      );
      return redirect("/dashboard/admin");
    } catch (error) {
      logger.error(`Error duplicating workshop: ${error}`, {
        url: request.url,
      });
      return { error: "Failed to duplicate workshop" };
    }
  }

  if (action === "updateRegistrationResult") {
    const registrationId = formData.get("registrationId");
    const newResult = formData.get("newResult");
    if (registrationId && newResult) {
      try {
        await updateRegistrationResult(
          Number(registrationId),
          String(newResult)
        );
        logger.info(
          `[User: ${roleUser?.userId}] updateRegistrationResult on workshop ${workshopId} successfully executed`,
          { url: request.url }
        );
        return redirect("/dashboard/admin");
      } catch (error) {
        logger.error(
          `Error updating registration result for Workshop: ${error}`,
          { url: request.url }
        );
        return { error: "Failed to update registration result" };
      }
    }
  }

  if (action === "passAll") {
    const registrationIdsStr = formData.get("registrationIds");
    if (registrationIdsStr) {
      const registrationIds = JSON.parse(
        registrationIdsStr as string
      ) as number[];
      try {
        await updateMultipleRegistrations(registrationIds, "passed");
        logger.info(
          `[User: ${roleUser?.userId}] passAll executed for ${registrationIds.length} registrations on workshop ${workshopId}`,
          {
            registrationIds,
            url: request.url,
          }
        );
        return redirect("/dashboard/admin");
      } catch (error) {
        logger.error(
          `Error updating multiple registrations (passAll) for Workshop: ${error}`,
          {
            registrationIds,
            url: request.url,
          }
        );
        return { error: "Failed to pass all registrations" };
      }
    }
  }

  return null;
}

export default function AdminDashboard() {
  const { roleUser, workshops, pastVisibilityDays } = useLoaderData() as {
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
  };

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Check if user is not logged in (guest)
  const isGuest = !roleUser || !roleUser.userId;

  // Filtering logic based on current date and past visibility setting
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
          <div className="flex justify-end mb-6 pr-4">
            <Link to="/dashboard/addworkshop">
              <button className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                <FiPlus size={18} /> Add Workshop
              </button>
            </Link>
          </div>

          {/* Active Workshops Section */}
          {activeWorkshops.length > 0 ? (
            <WorkshopList
              title="Active Workshops"
              workshops={activeWorkshops}
              isAdmin={true}
            />
          ) : (
            <p className="text-gray-600 mt-4">No active workshops available.</p>
          )}

          {/* Active Orientations Section */}
          {activeOrientations.length > 0 ? (
            <WorkshopList
              title="Active Orientations"
              workshops={activeOrientations}
              isAdmin={true}
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
              isAdmin={true}
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
