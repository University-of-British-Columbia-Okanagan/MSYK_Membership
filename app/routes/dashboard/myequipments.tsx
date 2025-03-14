import { useLoaderData, redirect } from "react-router-dom";
import { getUserBookedEquipments } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import EquipmentCard from "@/components/ui/Dashboard/equipmentcard";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { cancelEquipmentBooking } from "~/models/equipment.server";


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

export async function action({ request }: { request: Request }) {
    const formData = await request.formData();
    const actionType = formData.get("action");
    const bookingId = Number(formData.get("bookingId"));
  
    if (actionType === "cancel" && bookingId) {
      try {
        await cancelEquipmentBooking(bookingId);
        return json({ success: "Booking cancelled successfully!" });
      } catch (error) {
        return json({ errors: { message: error.message } }, { status: 400 });
      }
    }
  
    return json({ errors: { message: "Invalid action." } }, { status: 400 });
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
                    key={booking.id}
                    id={booking.id}
                    name={booking.name}
                    description={booking.description}
                    imageUrl={booking.imageUrl}
                    status="booked" // Always "booked" in MyEquipments.tsx
                    bookingId={booking.bookingId} // Required for cancel button
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