import { useLoaderData, redirect } from "react-router";
import {
  getUserWorkshopsWithOccurrences,
  getUserWorkshopRegistrations,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import WorkshopList from "~/components/ui/Dashboard/WorkshopList";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/AdminSidebar";

export async function loader({ request }: { request: Request }) {
  try {
    // 1. Get the current user
    const roleUser = await getRoleUser(request);
    if (!roleUser || !roleUser.userId) {
      return redirect("/login");
    }

    // 2. Fetch "my workshops" for this user, including occurrences:
    const myWorkshops = await getUserWorkshopsWithOccurrences(roleUser.userId);

    // 3. Transform each workshop to ensure "isRegistered" is initially false
    let transformed = myWorkshops.map((w) => ({
      ...w,
      isRegistered: false,
    }));

    // 4. Find which occurrences this user is registered for
    const registrations = await getUserWorkshopRegistrations(roleUser.userId);
    const registeredOccurrenceIds = new Set(
      registrations.map((reg: any) => reg.occurrenceId)
    );

    // 5. Mark each workshop as "isRegistered" if any occurrence is found in the user’s registrations
    transformed = transformed.map((workshop) => ({
      ...workshop,
      isRegistered: workshop.occurrences.some((occ: any) =>
        registeredOccurrenceIds.has(occ.id)
      ),
    }));

    // 6. Return plain data (no json())
    return { roleUser, workshops: transformed };
  } catch (error) {
    // If something goes wrong (e.g., user not logged in), redirect
    return redirect("/login");
  }
}

export default function MyWorkshops() {
  const { workshops, roleUser } = useLoaderData<typeof loader>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          {workshops.length > 0 ? (
            <WorkshopList
              title="My Workshops"
              workshops={workshops}
              isAdmin={false}
            />
          ) : (
            <p className="text-gray-600 mt-4">
              You are not registered for any workshops.
            </p>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
