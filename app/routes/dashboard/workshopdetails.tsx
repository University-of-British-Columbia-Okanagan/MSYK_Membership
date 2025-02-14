import { useParams, useLoaderData, useFetcher } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { getWorkshopById , checkUserRegistration} from "../../models/workshop.server";
import { getUser } from "~/utils/session.server";
import { useState, useEffect } from "react"; // Import useState and useEffect

export async function loader({ params, request }) {
  const workshopId = parseInt(params.id);
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  const user = await getUser(request); // Get the logged-in user

  // Check if user is registered for this workshop
  let isRegistered = false;
  if (user) {
    const registration = await checkUserRegistration(workshopId, user.id);
    isRegistered = !!registration; 
  }

  return { workshop, user, isRegistered };
}


export default function WorkshopDetails() {
  const { workshop, user, isRegistered: initialIsRegistered } = useLoaderData(); // Get initial registration status
  const fetcher = useFetcher();
  const [isRegistered, setIsRegistered] = useState(initialIsRegistered);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("success");

  // Handle registration status based on fetcher data
  useEffect(() => {
    if (fetcher.data?.success) {
      setIsRegistered(true);
      setPopupMessage("Registration successful!");
      setPopupType("success");
      setShowPopup(true);
    } else if (fetcher.data?.error) {
      setPopupMessage(fetcher.data.error);
      setPopupType("error");
      setShowPopup(true);
    }
  }, [fetcher.data]);

  const handleRegister = () => {
    if (!user) {
      setPopupMessage("Please log in to register for a workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    if (isRegistered) {
      setPopupMessage("You are already registered for this workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    console.log("Submitting registration for user:", user.id);
    fetcher.submit(
      { userId: user.id },
      { method: "post", action: `/dashboard/register/${workshop.id}` }
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Popup Notification */}
      {showPopup && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
            popupType === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {popupMessage}
        </div>
      )}

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
          <p className="text-gray-600">
            Date: {new Date(workshop.eventDate).toLocaleString()}
          </p>
          <p className="text-gray-600">Capacity: {workshop.capacity}</p>

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold">Cancellation Policy</h2>
          <p className="text-gray-600">
            Can't make it? Email{" "}
            <a href="mailto:info@makerspaceyk.com" className="text-blue-500">
              info@makerspaceyk.com
            </a>
            . Full refunds are only available if canceled 48 hours in advance.
          </p>

          <div className="mt-6 flex justify-between items-center">
            <Button
              onClick={handleRegister}
              disabled={fetcher.state !== "idle" || !user || isRegistered}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {fetcher.state !== "idle"
                ? "Registering..."
                : isRegistered
                ? "Already Registered"
                : "Register for Workshop"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboardlayout/workshops">Back to Workshops</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}