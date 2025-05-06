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
  cancelUserWorkshopRegistration,
} from "../../models/workshop.server";
import { getUser, getRoleUser } from "~/utils/session.server";
import { useState, useEffect } from "react";
import { AlertCircle, Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link as RouterLink } from "react-router-dom";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "cancelRegistration") {
    const workshopId = formData.get("workshopId");
    const occurrenceId = formData.get("occurrenceId");

    // Retrieve user from session
    const user = await getUser(request);
    if (!user) {
      return { error: "User not authenticated" };
    }

    try {
      await cancelUserWorkshopRegistration({
        workshopId: Number(workshopId),
        occurrenceId: Number(occurrenceId),
        userId: user.id,
      });
      return { success: true, cancelled: true };
    } catch (error) {
      console.error("Error cancelling registration:", error);
      return { error: "Failed to cancel registration" };
    }
  }
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

  // State to track which occurrence's cancel confirmation should be shown
  const [confirmOccurrenceId, setConfirmOccurrenceId] = useState<number | null>(
    null
  );

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.cancelled) {
        setPopupMessage("You have successfully cancelled your registration.");
      } else {
        setPopupMessage("🎉 Registration successful!");
        localStorage.setItem("registrationSuccess", "true");
      }
      setPopupType("success");
      setShowPopup(true);
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

    navigate(`/dashboard/payment/${workshop.id}/${occurrenceId}`);
  };

  // Offer Again button for Admins
  const handleOfferAgain = () => {
    navigate(`/dashboard/workshops/offer/${workshop.id}`);
  };

  const handleCancel = (occurrenceId: number) => {
    if (!user) return;
    fetcher.submit(
      {
        workshopId: String(workshop.id),
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

  // Check if this workshop is a continuation (any occurrence has a non-null connectId)
  const isContinuation = workshop.occurrences.some(
    (occ: any) => occ.connectId !== null
  );

  // If user is registered for ANY occurrence in a continuation workshop,
  // consider them registered for the entire workshop.
  const isUserRegisteredForAny = workshop.occurrences.some(
    (occ: any) => registrations[occ.id]?.registered
  );

  // Gather the earliest registration date for cancellation window
  const userRegistrationDates = workshop.occurrences
    .filter((occ: any) => registrations[occ.id]?.registered)
    .map((occ: any) => {
      const dateVal = registrations[occ.id]?.registeredAt;
      return dateVal ? new Date(dateVal) : null;
    })
    .filter((d: Date | null) => d !== null) as Date[];

  const earliestRegDate =
    userRegistrationDates.length > 0
      ? new Date(Math.min(...userRegistrationDates.map((d) => d.getTime())))
      : null;

  // Check if ALL occurrences are "past" or "cancelled"
  const allPast = workshop.occurrences.every(
    (occ: any) => occ.status === "past"
  );
  const allCancelled = workshop.occurrences.every(
    (occ: any) => occ.status === "cancelled"
  );

  // For continuation workshops: single registration/cancellation handling
  function handleRegisterAll() {
    if (!user) {
      setPopupMessage("Please log in to register for this workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    if (!hasCompletedAllPrerequisites) {
      setPopupMessage("You must complete all prerequisites first.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    // Find the first active occurrence that has a non-null connectId
    const firstActiveOccurrence = workshop.occurrences.find(
      (occ: any) =>
        occ.status !== "past" &&
        occ.status !== "cancelled" &&
        occ.connectId !== null
    );

    if (!firstActiveOccurrence) {
      setPopupMessage("No active occurrences available to register.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    // Navigate to the payment route using connectId (note the route now includes "connect")
    navigate(
      `/dashboard/payment/${workshop.id}/connect/${firstActiveOccurrence.connectId}`
    );
  }

  function handleCancelAll() {
    if (!user) return;
    // Cancel each active occurrence
    workshop.occurrences.forEach((occ: any) => {
      if (occ.status !== "past" && occ.status !== "cancelled") {
        fetcher.submit(
          {
            workshopId: String(workshop.id),
            occurrenceId: occ.id.toString(),
            actionType: "cancelRegistration",
          },
          { method: "post" }
        );
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
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

      <Card className="mt-6 shadow-lg">
        <CardHeader className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-bold">
              {workshop.name}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {workshop.description}
            </CardDescription>
          </div>

          {/* Admin Only: View Users Button */}
          {isAdmin && (
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 ml-auto"
              onClick={() =>
                navigate(`/dashboard/admin/workshop/${workshop.id}/users`)
              }
            >
              <Users size={18} />
              View Users ({workshop.userCount})
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              className="text-green-600 border-green-500 hover:bg-green-50 flex items-center gap-2 ml-auto"
              onClick={() => handleOfferAgain()}
            >
              Offer Again
            </Button>
          )}
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="px-4 py-2 text-lg font-medium">
              ${workshop.price}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-lg font-medium">
              {workshop.location}
            </Badge>
          </div>

          <Separator className="my-6" />

          {/* Continuation Workshop Block */}
          {isContinuation ? (
            <>
              <h2 className="text-lg font-semibold mb-4">Workshop Dates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workshop.occurrences.map((occ: any) => (
                  <div
                    key={occ.id}
                    className="border p-4 rounded-lg shadow-md bg-gray-50"
                  >
                    <p className="text-lg font-medium text-gray-800">
                      📅 {new Date(occ.startDate).toLocaleString()} -{" "}
                      {new Date(occ.endDate).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              {/* Single registration/cancellation for the entire workshop */}
              {allPast ? (
                <Badge className="bg-gray-500 text-white px-3 py-1">Past</Badge>
              ) : allCancelled ? (
                <Badge className="bg-red-500 text-white px-3 py-1">
                  Cancelled
                </Badge>
              ) : (
                (() => {
                  // Check if ANY workshop date has passed the current date
                  const anyDatePassed = workshop.occurrences.some(
                    (occ: any) => new Date(occ.endDate) < new Date()
                  );

                  if (anyDatePassed) {
                    return (
                      <Badge className="bg-gray-500 text-white px-3 py-1">
                        Workshop has passed
                      </Badge>
                    );
                  } else if (isUserRegisteredForAny) {
                    const canCancel =
                      earliestRegDate &&
                      (new Date().getTime() - earliestRegDate.getTime()) /
                        (1000 * 60 * 60) <
                        48;
                    return (
                      <div className="flex items-center gap-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge className="bg-green-500 text-white px-3 py-1 cursor-pointer">
                              Registered (Entire Workshop)
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canCancel ? (
                              <>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    handleCancelAll();
                                  }}
                                >
                                  Yes, Cancel Entire Workshop
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                  }}
                                >
                                  No, Keep Registration
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuItem disabled>
                                      Cancel Entire Workshop
                                    </DropdownMenuItem>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>48 hours have passed; cannot cancel.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  } else {
                    return (
                      <Button
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleRegisterAll()}
                        disabled={!hasCompletedAllPrerequisites}
                      >
                        Register for Entire Workshop
                      </Button>
                    );
                  }
                })()
              )}
            </>
          ) : (
            // Non-continuation workshop: existing per-occurrence UI
            <>
              <h2 className="text-lg font-semibold mb-4">Available Dates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workshop.occurrences.map((occurrence: Occurrence) => {
                  const regData = registrations[occurrence.id] || {
                    registered: false,
                    registeredAt: null,
                  };
                  const isOccurrenceRegistered = regData.registered;

                  return (
                    <div
                      key={occurrence.id}
                      className="border p-4 rounded-lg shadow-md bg-gray-50"
                    >
                      <p className="text-lg font-medium text-gray-800">
                        📅 {new Date(occurrence.startDate).toLocaleString()} -{" "}
                        {new Date(occurrence.endDate).toLocaleString()}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        {occurrence.status === "cancelled" ? (
                          <Badge className="bg-red-500 text-white px-3 py-1">
                            Cancelled
                          </Badge>
                        ) : occurrence.status === "past" ? (
                          <>
                            <Badge className="bg-gray-500 text-white px-3 py-1">
                              Past
                            </Badge>
                          </>
                        ) : isOccurrenceRegistered ? (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Badge className="bg-green-500 text-white px-3 py-1 cursor-pointer">
                                  Registered
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {confirmOccurrenceId === occurrence.id ? (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        handleCancel(occurrence.id);
                                        setConfirmOccurrenceId(null);
                                      }}
                                    >
                                      Yes, Cancel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        setConfirmOccurrenceId(null);
                                      }}
                                    >
                                      No, Keep Registration
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    {(() => {
                                      // Determine if cancel should be allowed (<48 hours)
                                      const canCancel =
                                        earliestRegDate &&
                                        (new Date().getTime() -
                                          earliestRegDate.getTime()) /
                                          (1000 * 60 * 60) <
                                          48;
                                      return canCancel ? (
                                        <DropdownMenuItem
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            setConfirmOccurrenceId(
                                              occurrence.id
                                            );
                                          }}
                                        >
                                          Cancel
                                        </DropdownMenuItem>
                                      ) : (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <DropdownMenuItem disabled>
                                                Cancel
                                              </DropdownMenuItem>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                48 hours have passed; cannot
                                                cancel.
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      );
                                    })()}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : (
                          <Button
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                            onClick={() => handleRegister(occurrence.id)}
                            disabled={!hasCompletedAllPrerequisites}
                          >
                            Register
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Separator className="my-6" />

          {/* Prerequisites Section */}
          {prerequisiteWorkshops.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-2">Prerequisites</h2>
              <ul className="list-disc pl-5 mb-4">
                {prerequisiteWorkshops.map((prereq) => (
                  <li
                    key={prereq.id}
                    className={`text-lg ${
                      prereq.completed ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    <Link
                      to={`/dashboard/workshops/${prereq.id}`}
                      className="hover:underline"
                    >
                      {prereq.name}
                    </Link>
                    {prereq.completed ? " ✓ (Completed)" : " ✗ (Not completed)"}
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

          <h2 className="text-lg font-semibold">Cancellation Policy</h2>
          <p
            className="text-gray-600"
            dangerouslySetInnerHTML={{
              __html: workshop.cancellationPolicy.replace(
                "info@makerspaceyk.com",
                `<a href="mailto:info@makerspaceyk.com" class="text-blue-500 hover:underline">info@makerspaceyk.com</a>`
              ),
            }}
          />

          <div className="mt-6">
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg"
              onClick={() => navigate("/dashboard/workshops")}
            >
              Back to Workshops
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
