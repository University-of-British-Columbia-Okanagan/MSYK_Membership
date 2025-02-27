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
  getUserCompletedPrerequisites,
} from "../../models/workshop.server";
import { getUser, getRoleUser } from "~/utils/session.server";
import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Occurrence {
  id: number;
  startDate: Date;
  endDate: Date;
  status: string;
}

interface PrerequisiteWorkshop {
  id: number;
  name: string;
  completed: boolean;
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

  // Track completed prerequisites and prerequisite workshop details
  let prerequisiteWorkshops: PrerequisiteWorkshop[] = [];
  let hasCompletedAllPrerequisites = false;

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

    // Fetch user's completed prerequisites for this workshop
    const completedPrerequisites = await getUserCompletedPrerequisites(
      user.id,
      workshopId
    );

    // Fetch prerequisite workshop names and completion status
    if (workshop.prerequisites && workshop.prerequisites.length > 0) {
      prerequisiteWorkshops = await Promise.all(
        workshop.prerequisites.map(async (prereq) => {
          // Check if prereq is an object or a number
          const id =
            typeof prereq === "object" ? prereq.prerequisiteId : prereq;
          const prereqWorkshop = await getWorkshopById(id);

          // Check if the user has completed this prerequisite
          const isCompleted = completedPrerequisites.includes(id);

          return prereqWorkshop
            ? { id, name: prereqWorkshop.name, completed: isCompleted }
            : { id, name: `Workshop #${id}`, completed: isCompleted };
        })
      );

      // Check if all prerequisites are completed
      hasCompletedAllPrerequisites = prerequisiteWorkshops.every(
        (prereq) => prereq.completed
      );
    } else {
      // If there are no prerequisites, user is eligible
      hasCompletedAllPrerequisites = true;
    }
  } else {
    // If no prerequisites or user not logged in, set default values
    if (workshop.prerequisites && workshop.prerequisites.length > 0) {
      prerequisiteWorkshops = await Promise.all(
        workshop.prerequisites.map(async (prereq) => {
          const id =
            typeof prereq === "object" ? prereq.prerequisiteId : prereq;
          const prereqWorkshop = await getWorkshopById(id);
          return prereqWorkshop
            ? { id, name: prereqWorkshop.name, completed: false }
            : { id, name: `Workshop #${id}`, completed: false };
        })
      );
    }
    hasCompletedAllPrerequisites = false; // Default to false when not logged in
  }

  return {
    workshop,
    user,
    registrations,
    roleUser,
    prerequisiteWorkshops,
    hasCompletedAllPrerequisites,
  };
}

export default function WorkshopDetails() {
  const {
    workshop,
    user,
    registrations,
    roleUser,
    prerequisiteWorkshops,
    hasCompletedAllPrerequisites,
  } = useLoaderData();
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

    if (!hasCompletedAllPrerequisites) {
      setPopupMessage(
        "You must complete all prerequisites before registering."
      );
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

  // Get list of incomplete prerequisites
  const incompletePrerequisites = prerequisiteWorkshops.filter(
    (prereq: PrerequisiteWorkshop) => !prereq.completed
  );
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

          {/* Updated Prerequisites section with completion status */}
          {prerequisiteWorkshops && prerequisiteWorkshops.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-2">Prerequisites</h2>
              <ul className="list-disc pl-5 mb-4">
                {prerequisiteWorkshops.map((prereq: PrerequisiteWorkshop) => (
                  <li
                    key={prereq.id}
                    className={
                      prereq.completed ? "text-green-600" : "text-red-600"
                    }
                  >
                    <Link
                      to={`/dashboard/workshops/${prereq.id}`}
                      className="hover:underline"
                    >
                      {prereq.name}
                    </Link>
                    {prereq.completed
                      ? " ✓ (Completed)"
                      : ` ✗ (${
                          user ? "Not completed" : "Login to check status"
                        })`}
                  </li>
                ))}
              </ul>

              {/* Show warning if prerequisites are not complete */}
              {user && !hasCompletedAllPrerequisites && (
                <div className="bg-amber-50 border border-amber-300 p-3 rounded-md mb-4 flex items-start">
                  <AlertCircle className="text-amber-500 mr-2 h-5 w-5 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Prerequisites Required
                    </p>
                    <p className="text-amber-700">
                      Complete the following prerequisites before registering:
                    </p>
                    <ul className="list-disc pl-5 text-amber-700">
                      {incompletePrerequisites.map((prereq: PrerequisiteWorkshop) => (
                        <li key={prereq.id}>
                          <Link
                            to={`/dashboard/workshops/${prereq.id}`}
                            className="text-amber-800 hover:underline"
                          >
                            {prereq.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <Separator className="my-6" />
            </>
          )}

          {/* Display Available Dates */}
          <h2 className="text-lg font-semibold">Available Dates</h2>
          {workshop.occurrences.map((occurrence: Occurrence) => {
            // Check if the user is registered for this specific occurrence
            const isOccurrenceRegistered =
              registrations[occurrence.id] || false;

            // Determine button state
            const isDisabled =
              occurrence.status !== "active" ||
              isOccurrenceRegistered ||
              (user && !hasCompletedAllPrerequisites) ||
              !user;

            // Determine button text based on status
            let buttonText = "";
            let tooltipText = "";

            if (occurrence.status === "cancelled") {
              buttonText = "Cancelled";
              tooltipText = "This workshop occurrence has been cancelled.";
            } else if (occurrence.status === "past") {
              buttonText = "Past";
              tooltipText = "This workshop occurrence has already taken place.";
            } else if (isOccurrenceRegistered) {
              buttonText = "Already Registered";
              tooltipText = "You are already registered for this occurrence.";
            } else if (!user) {
              buttonText = "Register";
              tooltipText = "Please log in to register for this workshop.";
            } else if (!hasCompletedAllPrerequisites) {
              buttonText = "Prerequisites Required";
              tooltipText =
                "You must complete all prerequisites before registering.";
            } else {
              buttonText = "Register";
              tooltipText = "";
            }

            return (
              <li key={occurrence.id} className="text-gray-600 mb-2">
                📅 {new Date(occurrence.startDate).toLocaleString()} -{" "}
                {new Date(occurrence.endDate).toLocaleString()}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          className="ml-2 bg-blue-500 text-white px-2 py-1 rounded mr-2"
                          onClick={() => handleRegister(occurrence.id)}
                          disabled={isDisabled}
                        >
                          {buttonText}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {tooltipText && (
                      <TooltipContent>
                        <p>{tooltipText}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
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
