import { useLoaderData, redirect } from "react-router-dom";
import { getUserBookedEquipments } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import EquipmentCard from "~/components/ui/Dashboard/EquipmentCard";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import { cancelEquipmentBooking } from "~/models/equipment.server";
import { getBookingEmailDetails } from "~/models/equipment.server";
import { sendEquipmentCancellationEmail } from "~/utils/email.server";
import { json } from "@remix-run/node";
import { logger } from "~/logging/logger";

export async function loader({ request }: { request: Request }) {
  try {
    const roleUser = await getRoleUser(request);

    if (!roleUser || !roleUser.userId) {
      logger.warn("No valid user found, redirecting to login.", {
        url: request.url,
      });
      return redirect("/login");
    }

    // Fetch booked equipment
    logger.info(`Fetching booked equipment for userId: ${roleUser.userId}`, {
      url: request.url,
    });
    const myEquipments = await getUserBookedEquipments(roleUser.userId);

    return { roleUser, equipments: myEquipments };
  } catch (error) {
    logger.error(`Error in loader: ${error}`, { url: request.url });
    return redirect("/login");
  }
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("action");
  const bookingId = Number(formData.get("bookingId"));

  const roleUser = await getRoleUser(request);
  if (!roleUser || !roleUser.userId) {
    logger.warn("No valid user found, redirecting to login.", {
      url: request.url,
    });
    return redirect("/login");
  }
  const myEquipments = await getUserBookedEquipments(roleUser.userId);

  const hasBooking =
    myEquipments.some((equipment) => equipment.id === bookingId) ||
    roleUser.roleName.toLowerCase() === "admin";
  if (!hasBooking) {
    return new Response("Can only edit your own booking", { status: 419 });
  }

  if (actionType === "cancel" && bookingId) {
    try {
      // Get details before deletion for email composition
      const emailDetails = await getBookingEmailDetails(bookingId);

      await cancelEquipmentBooking(bookingId);

      // Send email after successful cancellation (non-blocking)
      if (emailDetails) {
        const { userEmail, equipmentName, startTime, endTime } = emailDetails;
        try {
          await sendEquipmentCancellationEmail({
            userEmail,
            equipmentName,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
          });
        } catch (emailErr) {
          logger.error(
            `Failed to send equipment cancellation email: ${emailErr}`,
            {
              url: request.url,
            }
          );
        }
      }
      return json({ success: "Booking cancelled successfully!" });
    } catch (error) {
      return json(
        {
          errors: {
            message:
              error instanceof Error ? error.message : "An error occurred",
          },
        },
        { status: 400 }
      );
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
                  description={booking.description || ""}
                  imageUrl={booking.imageUrl || undefined}
                  status="booked" // Always "booked" in MyEquipments.tsx
                  bookingId={booking.bookingId} // Required for cancel button
                  startTime={booking.startTime}
                  endTime={booking.endTime}
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
