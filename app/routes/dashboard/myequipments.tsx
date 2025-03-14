import { useLoaderData, redirect } from "react-router-dom";
import { getUserBookedEquipments } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import EquipmentCard from "@/components/ui/Dashboard/equipmentcard";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";

export async function loader({ request }: { request: Request }) {
    try {
      // 🔍 DEBUG: Check if session retrieval works
      console.log("Fetching user session...");
      const roleUser = await getRoleUser(request);
     
  
      
      if (!roleUser || !roleUser.userId) {
        console.log(" No valid user found, redirecting to login.");
        return redirect("/login");
      }
  
      // DEBUG: Fetch booked equipment
      console.log(`Fetching booked equipment for userId: ${roleUser.userId}`);
      const myEquipments = await getUserBookedEquipments(roleUser.userId);
      
      console.log("Fetched equipments:", myEquipments);
  
      return { roleUser, equipments: myEquipments };
    } catch (error) {
      console.error("Error in loader:", error);
      return redirect("/login");
    }
  }
  

  export default function MyEquipments() {
    const { equipments, roleUser } = useLoaderData<typeof loader>();
    const isAdmin = roleUser?.roleName.toLowerCase() === "admin";
  
    return (
      <SidebarProvider>
        <div className="flex h-screen">
          {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
          <main className="flex-grow p-6">
            <h1 className="text-2xl font-bold mb-6">My Equipments</h1>
  
            {equipments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {equipments.map((booking) => (
                  <EquipmentCard
                    key={booking.equipment.id} // Use equipment ID for uniqueness
                    id={booking.equipment.id}
                    name={booking.equipment.name}
                    description={booking.equipment.description}
                    imageUrl={booking.equipment.imageUrl}
                    status="booked" // Pass "booked" as status
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-600 mt-4">No equipment bookings found.</p>
            )}
          </main>
        </div>
      </SidebarProvider>
    );
  }