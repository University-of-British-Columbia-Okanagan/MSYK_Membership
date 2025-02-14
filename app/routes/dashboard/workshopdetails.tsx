import { useParams, useLoaderData, useFetcher } from "react-router-dom";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getWorkshopById } from "../../models/workshop.server";
import { getUser } from "~/utils/session.server";

export async function loader({ params, request }) {
  const workshopId = parseInt(params.id);
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }
  const user = await getUser(request);
  return { workshop, user };
}

export default function WorkshopDetails() {
  const { workshop, user } = useLoaderData();
  const fetcher = useFetcher();

  const handleRegister = () => {
    if (!user) {
      alert("Please log in to register for a workshop");
      return;
    }
    console.log("Submitting registration for user:", user.id); // Debugging
    fetcher.submit(
      { userId: user.id },
      { method: "post", action: `/dashboard/register/${workshop.id}` } // Corrected path
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-2xl">{workshop.name}</CardTitle>
          <CardDescription>{workshop.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex gap-2">
            <Badge variant="outline">{workshop.status}</Badge>
            <Badge variant="outline">${workshop.price}</Badge>
            <Badge variant="outline">{workshop.location}</Badge>
          </div>

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold">Event Details</h2>
          <p className="text-gray-600">Date: {new Date(workshop.eventDate).toLocaleString()}</p>
          <p className="text-gray-600">Capacity: {workshop.capacity}</p>

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold">Cancellation Policy</h2>
          <p className="text-gray-600">
            Can't make it? Email <a href="mailto:info@makerspaceyk.com" className="text-blue-500">info@makerspaceyk.com</a>.
            Full refunds are only available if canceled 48 hours in advance.
          </p>

          <div className="mt-6 flex justify-between items-center">
            <Button
              onClick={handleRegister}
              disabled={fetcher.state !== "idle" || !user}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {fetcher.state !== "idle" ? 'Registering...' : 'Register for Workshop'}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboardlayout/workshops">Back to Workshops</Link>
            </Button>
          </div>

          {fetcher.data?.error && (
            <p className="text-red-500 mt-2">{fetcher.data.error}</p>
          )}
          {fetcher.data?.success && (
            <p className="text-green-500 mt-2">Successfully registered for workshop!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
