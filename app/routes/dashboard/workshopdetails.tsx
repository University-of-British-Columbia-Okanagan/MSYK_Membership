import {
  useParams,
  useLoaderData,
  useFetcher,
  useNavigate,
  Link,
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
import { Link as RouterLink } from "react-router-dom";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

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

  // Instead of storing just a boolean, we'll store { registered, registeredAt } for each occurrence
  let registrations: {
    [occurrenceId: number]: {
      registered: boolean;
      registeredAt: Date | null;
    };
  } = {};

  // Track completed prerequisites and prerequisite workshop details
  let prerequisiteWorkshops: PrerequisiteWorkshop[] = [];
  let hasCompletedAllPrerequisites = false;

  if (user) {
    // For each occurrence, check if the user is registered and get the registration time
    for (const occ of workshop.occurrences) {
      const regRow = await checkUserRegistration(workshopId, user.id, occ.id);
      // regRow returns { registered, registeredAt }
      registrations[occ.id] = {
        registered: regRow.registered,
        registeredAt: regRow.registeredAt,
      };
    }

    // Fetch user's completed prerequisites for this workshop
    const completedPrerequisites = await getUserCompletedPrerequisites(
      user.id,
      workshopId
    );

    // Fetch prerequisite workshop names and completion status
    if (workshop.prerequisites && workshop.prerequisites.length > 0) {
      prerequisiteWorkshops = await Promise.all(
        workshop.prerequisites.map(async (prereq) => {
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
  } = useLoaderData() as {
    workshop: any;
    user: any;
    registrations: {
      [occurrenceId: number]: {
        registered: boolean;
        registeredAt: Date | null;
      };
    };
    roleUser: any;
    prerequisiteWorkshops: PrerequisiteWorkshop[];
    hasCompletedAllPrerequisites: boolean;
  };

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

  const handleCancel = (occurrenceId: number) => {
    if (!user) return;
    fetcher.submit(
      {
        occurrenceId: occurrenceId.toString(),
        actionType: "cancelRegistration",
      },
      { method: "post" }
    );
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

          {/* Prerequisites Section */}
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
                      {incompletePrerequisites.map(
                        (prereq: PrerequisiteWorkshop) => (
                          <li key={prereq.id}>
                            <Link
                              to={`/dashboard/workshops/${prereq.id}`}
                              className="text-amber-800 hover:underline"
                            >
                              {prereq.name}
                            </Link>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              )}
              <Separator className="my-6" />
            </>
          )}

          {/* Available Dates Section */}
          <h2 className="text-lg font-semibold">Available Dates</h2>
          {workshop.occurrences.map((occurrence: Occurrence) => {
            const regData = registrations[occurrence.id] || {
              registered: false,
              registeredAt: null,
            };
            const isOccurrenceRegistered = regData.registered;

            // If the user is registered, calculate hours since registration
            let canCancel = false;
            if (isOccurrenceRegistered && regData.registeredAt) {
              const now = new Date();
              const regTime = new Date(regData.registeredAt);
              const hoursSinceRegistration =
                (now.getTime() - regTime.getTime()) / (1000 * 60 * 60);
              // Allow cancellation if within 48 hours since registration
              canCancel = hoursSinceRegistration <= 48;
            }

            let buttonText = "";
            let tooltipText = "";

            if (occurrence.status === "cancelled") {
              buttonText = "Cancelled";
              tooltipText = "This workshop occurrence has been cancelled.";
            } else if (occurrence.status === "past") {
              buttonText = "Past";
              tooltipText = "This workshop occurrence has already taken place.";
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
                {isOccurrenceRegistered ? (
                  canCancel ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <ConfirmButton
                            confirmTitle="Cancel Registration"
                            confirmDescription="Are you sure you want to cancel your registration for this workshop time? You will be refunded."
                            onConfirm={() => handleCancel(occurrence.id)}
                            buttonLabel="Cancel Registration"
                            buttonClassName="ml-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded mr-2"
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Cancellation allowed: You will be refunded.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            className="ml-2 bg-gray-300 cursor-not-allowed text-gray-600 px-2 py-1 rounded mr-2"
                            disabled
                          >
                            Cancel Registration
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Cancellation not allowed (over 48 hours since
                            registration).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          className="ml-2 bg-blue-500 text-white px-2 py-1 rounded mr-2"
                          onClick={() => handleRegister(occurrence.id)}
                          disabled={
                            occurrence.status !== "active" ||
                            (user && !hasCompletedAllPrerequisites) ||
                            !user
                          }
                        >
                          {buttonText}
                        </Button>
                      </TooltipTrigger>
                      {tooltipText && (
                        <TooltipContent>
                          <p>{tooltipText}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
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
          <p
            className="text-gray-600"
            dangerouslySetInnerHTML={{
              __html: workshop.cancellationPolicy.replace(
                "info@makerspaceyk.com",
                `<a href="mailto:info@makerspaceyk.com" class="text-blue-500">info@makerspaceyk.com</a>`
              ),
            }}
          />
          <Button variant="outline" asChild className="mt-4">
            <Link to="/dashboardlayout/workshops">Back to Workshops</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
