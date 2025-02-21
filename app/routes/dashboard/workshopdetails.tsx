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
import {
  getWorkshopById,
  checkUserRegistration,
} from "../../models/workshop.server";
import { getUser } from "~/utils/session.server";
import { useState, useEffect } from "react";


export async function loader({ params, request }) {
  const workshopId = parseInt(params.id);
  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  const user = await getUser(request);

  let isRegistered = false;
  if (user) {
    const registration = await checkUserRegistration(workshopId, user.id);
    isRegistered = !!registration;
  }

  return { workshop, user, isRegistered };
}

export default function WorkshopDetails() {
  const { workshop, user, isRegistered: initialIsRegistered } = useLoaderData();
  const fetcher = useFetcher();
  const [isRegistered, setIsRegistered] = useState(initialIsRegistered);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("success");

  useEffect(() => {
    if (fetcher.data?.success) {
      setIsRegistered(true);
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

  const handleRegister = (occurrenceId) => {
    if (!user) {
      setPopupMessage("Please log in to register for a workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    fetcher.submit(
      { userId: user.id, occurrenceId },
      { method: "post", action: `/dashboard/register/${occurrenceId}` }
    );
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
          {workshop.occurrences.length > 0 ? (
            <ul>
              {workshop.occurrences.map((occurrence) => {
                const isPast = new Date(occurrence.startDate) < new Date();
                return (
                  <li key={occurrence.id} className="text-gray-600">
                    📅 {new Date(occurrence.startDate).toLocaleString()} -{" "}
                    {new Date(occurrence.endDate).toLocaleString()}
                    <Button
                      className="ml-2 bg-blue-500 text-white px-2 py-1 rounded"
                      onClick={() => handleRegister(occurrence.id)}
                      disabled={isRegistered || fetcher.state === "submitting"}
                    >
                      {isRegistered ? "Already Registered" : "Register"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500">No available dates.</p>
          )}

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
