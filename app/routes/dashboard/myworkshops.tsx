import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "react-router";

import { getUserWorkshops } from "~/models/workshop.server";
import WorkshopCard from "@/components/ui/Dashboard/workshopcard";
import AppSidebar from "@/components/ui/Dashboard/sidebar"; 
import { SidebarProvider } from "@/components/ui/sidebar"; 

export const loader = async ({ request }) => {
  try {
    const workshops = await getUserWorkshops(request);
    console.log("Fetched Workshops:", workshops);
    return json({ workshops });
  } catch (error) {
    return redirect("/login");
  }
};

export default function MyWorkshops() {
  const { workshops } = useLoaderData<typeof loader>();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {/* Sidebar */}
        <AppSidebar />

        {/* Main Content */}
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">My Workshops</h1>
        <div className="p-6 flex-grow">
          {/* <h1 className="text-2xl font-bold">My Workshops</h1> */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
            {workshops.length > 0 ? (
              workshops.map((workshop) => (
                <WorkshopCard title="My Workshops" key={workshop.id} {...workshop} isAdmin={false} isRegistered={true} />
              ))
            ) : (
              <p className="text-gray-600 mt-4">You are not registered for any workshops.</p>
            )}
          </div>
        </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
