import { useLoaderData, redirect } from "react-router";
import {
  getUserWorkshopsWithOccurrences,
  getUserWorkshopRegistrations,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import WorkshopCard from "~/components/ui/Dashboard/workshopcard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";

export async function loader({ request }: { request: Request }) {
  try {
    // 1. Get the current user
    const roleUser = await getRoleUser(request);
    if (!roleUser || !roleUser.userId) {
      return redirect("/login");
    }

    // 2. Fetch "my workshops" for this user, including occurrences:
    const myWorkshops = await getUserWorkshopsWithOccurrences(roleUser.userId);

    // 3. Fetch user's registration details with occurrence information
    const { db } = await import("~/utils/db.server");
    const registrations = await db.userWorkshop.findMany({
      where: {
        userId: roleUser.userId,
      },
      select: {
        occurrenceId: true,
        occurrence: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    // Create a map of occurrence ID to occurrence details (startDate, endDate)
    const registrationMap = new Map(
      registrations.map((reg) => [
        reg.occurrenceId,
        {
          startDate: reg.occurrence?.startDate,
          endDate: reg.occurrence?.endDate,
        },
      ])
    );

    // 4. Transform workshops to include registration time info
    const transformed = myWorkshops.map((workshop) => {
      // Find the first occurrence the user is registered for
      const registeredOccurrence = workshop.occurrences.find((occ: any) =>
        registrationMap.has(occ.id)
      );

      const regInfo = registeredOccurrence
        ? registrationMap.get(registeredOccurrence.id)
        : null;

      return {
        ...workshop,
        isRegistered: !!registeredOccurrence,
        registrationStartDate: regInfo?.startDate,
        registrationEndDate: regInfo?.endDate,
      };
    });

    // 5. Return plain data
    return { roleUser, workshops: transformed };
  } catch (error) {
    // If something goes wrong, redirect
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
      <div className="absolute inset-0 flex">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          {/* Mobile Header with Sidebar Trigger */}
          <div className="flex items-center gap-4 mb-6 md:hidden">
            <SidebarTrigger />
            <h1 className="text-xl font-bold">My Workshops</h1>
          </div>

          <h1 className="text-2xl font-bold mb-6 hidden md:block">
            My Workshops
          </h1>

          {workshops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.map((workshop) => (
                <WorkshopCard
                  key={workshop.id}
                  id={workshop.id}
                  name={workshop.name}
                  description={workshop.description}
                  price={workshop.price}
                  displayPrice={workshop.displayPrice}
                  type={workshop.type}
                  isAdmin={false}
                  imageUrl={workshop.imageUrl}
                  priceRange={workshop.priceRange}
                  hasPriceVariations={workshop.hasPriceVariations}
                  isMyWorkshops={true}
                  registrationStartDate={workshop.registrationStartDate}
                  registrationEndDate={workshop.registrationEndDate}
                />
              ))}
            </div>
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
