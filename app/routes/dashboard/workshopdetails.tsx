import {
  useParams,
  useLoaderData,
  useFetcher,
  useNavigate,
} from "react-router-dom";
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
import {
  getWorkshopById,
  checkUserRegistration,
} from "../../models/workshop.server";
import { getUser, getRoleUser } from "~/utils/session.server";
import { useState, useEffect } from "react";

interface Occurrence {
  id: number;
  startDate: Date;
  endDate: Date;
  status: string; // Add status field
}

export async function loader({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const workshopId = parseInt(params.id);
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  const user = await getUser(request);
  const roleUser = await getRoleUser(request);

  // Create a mapping of occurrenceId -> registration status.
  let registrations: { [occurrenceId: number]: boolean } = {};
  if (user) {
    // For each occurrence in the workshop, check if the user is registered.
    const registrationChecks = await Promise.all(
      workshop.occurrences.map((occurrence) =>
        checkUserRegistration(workshopId, user.id, occurrence.id)
      )
    );
    workshop.occurrences.forEach((occurrence, index) => {
      registrations[occurrence.id] = registrationChecks[index];
    });
  }

  return { workshop, user, registrations, roleUser };
}

export default function WorkshopDetails() {
  const { workshop, user, registrations, roleUser } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("success");

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  useEffect(() => {
    if (fetcher.data?.success) {
      setPopupMessage("🎉 Registration successful!");
      setPopupType("success");
      setShowPopup(true);
      localStorage.setItem("registrationSuccess", "true");
    } else if (fetcher.data?.error) {
      setPopupMessage(fetcher.data.error);
      setPopupType("error");
      setShowPopup(true);
    }
  }, [fetcher.data]);

  const handleRegister = (occurrenceId: number) => {
    if (!user) {
      setPopupMessage("Please log in to register for a workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    // Navigate to the payment page
    navigate(`/dashboard/payment/${workshop.id}/${occurrenceId}`);
  };

  const handleOfferAgain = (occurrenceId: number) => {
    navigate(`/dashboard/workshops/${workshop.id}/edit/${occurrenceId}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Popup Notification */}
      {showPopup && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
            popupType === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
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
            <Badge variant="outline">${workshop.price}</Badge>
            <Badge variant="outline">{workshop.location}</Badge>
          </div>

          <Separator className="my-6" />

          {/* Display Available Dates Here */}
          <h2 className="text-lg font-semibold">Available Dates</h2>
          {workshop.occurrences.map((occurrence: Occurrence) => {
            // Check if the user is registered for this specific occurrence
            const isOccurrenceRegistered =
              registrations[occurrence.id] || false;
            const buttonText =
              occurrence.status === "cancelled"
                ? "Cancelled"
                : occurrence.status === "past"
                ? "Past"
                : isOccurrenceRegistered
                ? "Already Registered"
                : "Register";

            return (
              <li key={occurrence.id} className="text-gray-600 mb-2">
                📅 {new Date(occurrence.startDate).toLocaleString()} -{" "}
                {new Date(occurrence.endDate).toLocaleString()}
                <Button
                  className="ml-2 bg-blue-500 text-white px-2 py-1 rounded mr-2"
                  onClick={() => handleRegister(occurrence.id)}
                  disabled={
                    occurrence.status !== "active" || isOccurrenceRegistered
                  }
                >
                  {buttonText}
                </Button>
                {occurrence.status === "past" && isAdmin && (
                  <Button
                    variant="outline"
                    className="text-green-600 border-green-500 hover:bg-green-50"
                    onClick={() => handleOfferAgain(occurrence.id)}
                  >
                    Offer Again
                  </Button>
                )}
              </li>
            );
          })}

          <Separator className="my-6" />

          <h2 className="text-lg font-semibold">Cancellation Policy</h2>
          <p className="text-gray-600">
            Can't make it? Email{" "}
            <a href="mailto:info@makerspaceyk.com" className="text-blue-500">
              info@makerspaceyk.com
            </a>
            . Full refunds are only available if canceled 48 hours in advance.
          </p>

          <Button variant="outline" asChild className="mt-4">
            <Link to="/dashboardlayout/workshops">Back to Workshops</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
