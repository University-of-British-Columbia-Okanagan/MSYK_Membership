import { useLoaderData, redirect } from "react-router";
import {
  getUserWorkshopsWithOccurrences,
  getUserWorkshopRegistrations,
  getUserWorkshopsWithRegistrationDetails,
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

    // 2. Fetch workshops with full registration details using the new function
    const workshops = await getUserWorkshopsWithRegistrationDetails(
      roleUser.userId
    );

    // 3. Return plain data
    return { roleUser, workshops };
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
                  registeredOccurrences={workshop.registeredOccurrences}
                  isMultiDay={workshop.isMultiDay}
                  priceVariation={workshop.priceVariation}
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
