import { useLoaderData, Form } from "react-router-dom";
import { getAllEquipmentWithBookings, toggleEquipmentAvailability } from "~/models/equipment.server";
import { Button } from "@/components/ui/button";
import { ShadTable, type ColumnDefinition } from "@/components/ui/ShadTable";
import { format } from "date-fns";
import { getRoleUser } from "~/utils/session.server";

// Loader
export async function loader() {
  const equipment = await getAllEquipmentWithBookings();
  return { equipment };
}

// Action to disable equipment
export async function action({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 419 });
  }
  const formData = await request.formData();
  const equipmentId = Number(formData.get("equipmentId"));
  const newAvailability = formData.get("availability") === "true";
  await toggleEquipmentAvailability(equipmentId, newAvailability);
  return null;
}
export default function AllEquipmentBookings() {
    const { equipment } = useLoaderData<typeof loader>();
  
    const columns: ColumnDefinition<typeof equipment[number]>[] = [
      {
        header: "Name",
        render: (eq) => eq.name,
      },
      {
        header: "Availability",
        render: (eq) => (eq.availability ? "Available" : "Disabled"),
      },
      {
        header: "Slots",
        render: (eq) =>
          eq.slots.length ? (
            <ul className="text-xs space-y-1">
              {eq.slots.map((slot) => {
                const time = format(new Date(slot.startTime), "EEE HH:mm");
                const source = slot.workshopOccurrence
                  ? `Workshop: ${slot.workshopOccurrence.workshop?.name}`
                  : slot.bookings.length
                  ? `User: ${slot.bookings[0].user.firstName} ${slot.bookings[0].user.lastName}`
                  : "Free";
                return (
                  <li key={slot.id}>
                    {time} →{" "}
                    <span className="font-medium">{slot.isBooked ? source : "Available"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="text-muted">No Slots</span>
          ),
      },
      {
        header: "Actions",
        render: (eq) => (
          <Form method="post">
            <input type="hidden" name="equipmentId" value={eq.id} />
            <input
              type="hidden"
              name="availability"
              value={(!eq.availability).toString()}
            />
            <Button type="submit" variant={eq.availability ? "destructive" : "default"}>
              {eq.availability ? "Disable" : "Enable"}
            </Button>
          </Form>
        ),
      },
    ];
  
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">All Equipment Bookings</h2>
        <ShadTable
          columns={columns}
          data={equipment}
          emptyMessage="No equipment found"
        />
      </div>
    );
  }
  