import {
  useParams,
  useLoaderData,
  useFetcher,
  useNavigate,
  Link,
  redirect,
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
import { getWorkshopVisibilityDays } from "../../models/admin.server";
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
import { duplicateWorkshop } from "~/models/workshop.server";

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

  // Get the current date
  const now = new Date();

  // Get admin settings for workshop visibility days
  const visibilityDays = await getWorkshopVisibilityDays();

  // Calculate the future cutoff date based on admin settings
  const futureCutoffDate = new Date();
  futureCutoffDate.setDate(futureCutoffDate.getDate() + visibilityDays);

  // Find the most recent (highest) offerId that has active dates
  const currentOfferIds = workshop.occurrences
    .filter(
      (occ: any) => new Date(occ.endDate) >= now && occ.status === "active"
    )
    .map((occ: any) => occ.offerId);

  // If there are no current offers, show all active future dates
  const latestOfferId =
    currentOfferIds.length > 0
      ? Math.max(...currentOfferIds)
      : Math.max(...workshop.occurrences.map((occ: any) => occ.offerId), 0);

  // Filter occurrences based on rules:
  // 1. Include all active dates from the latest offer
  // 2. Include past dates from the current offer
  // 3. Exclude past dates from previous offers
  // 4. Only show dates within the visibility window
  workshop.occurrences = workshop.occurrences.filter((occ: any) => {
    const occDate = new Date(occ.startDate);
    const isPast = occDate < now;
    const isCurrentOffer = occ.offerId === latestOfferId;
    const isWithinVisibilityWindow = occDate <= futureCutoffDate;

    // Include if:
    // - It's from the current offer (regardless of past/future)
    // - OR it's an active date from any offer within visibility window
    return (
      (isCurrentOffer || (!isPast && occ.status === "active")) &&
      isWithinVisibilityWindow
    );
  });

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

  if (actionType === "duplicate") {
    const roleUser = await getRoleUser(request);
    if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
      throw new Response("Not Authorized", { status: 419 });
    }
    const workshopId = formData.get("workshopId");
    const user = await getUser(request);
    if (!user) {
      return { error: "User not authenticated" };
    }

    try {
      // Call your duplicate function here
      // This should be implemented in your models/workshop.server
      // await duplicateWorkshop(Number(workshopId));
      await duplicateWorkshop(Number(workshopId));

      // Redirect to admin dashboard after duplication
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error duplicating workshop:", error);
      return { error: "Failed to duplicate workshop" };
    }
  }
}

/**
 * Check if current time is within the registration cutoff period
 * @param startDate Workshop start date
 * @param cutoffMinutes Registration cutoff in minutes
 * @returns true if within cutoff period (too late to register)
 */
const isWithinCutoffPeriod = (
  startDate: Date,
  cutoffMinutes: number
): boolean => {
  const now = new Date();
  const cutoffTime = new Date(startDate.getTime() - cutoffMinutes * 60 * 1000);
  return now >= cutoffTime;
};

/**
 * Format cutoff time in a human-readable format
 * @param minutes Cutoff minutes
 * @returns Formatted string (e.g., "1 hour and 15 minutes" or "30 minutes")
 */
const formatCutoffTime = (minutes: number): string => {
  if (minutes <= 0) {
    return "0 minutes";
  }

  if (minutes >= 1440) {
    // 1 day or more
    const days = Math.floor(minutes / 1440);
    const remainingMinutes = minutes % 1440;

    if (remainingMinutes === 0) {
      return `${days} ${days === 1 ? "day" : "days"}`;
    }

    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;

    let result = `${days} ${days === 1 ? "day" : "days"}`;
    if (hours > 0) {
      result += ` and ${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    if (mins > 0) {
      result += `${hours > 0 ? " and " : " and "}${mins} ${
        mins === 1 ? "minute" : "minutes"
      }`;
    }
    return result;
  } else if (minutes >= 60) {
    // 1 hour or more
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    } else {
      return `${hours} ${hours === 1 ? "hour" : "hours"} and ${mins} ${
        mins === 1 ? "minute" : "minutes"
      }`;
    }
  } else {
    // Less than 1 hour
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
};

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

  const sortedOccurrences = [...workshop.occurrences].sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  // Check if this workshop is a continuation (any occurrence has a non-null connectId)
  const isContinuation = sortedOccurrences.some(
    (occ: any) => occ.connectId !== null
  );

  // If user is registered for ANY occurrence in a continuation workshop,
  // consider them registered for the entire workshop.
  const isUserRegisteredForAny = sortedOccurrences.some(
    (occ: any) => registrations[occ.id]?.registered
  );

  const allPast = sortedOccurrences.every((occ: any) => occ.status === "past");

  const allCancelled = sortedOccurrences.every(
    (occ: any) => occ.status === "cancelled"
  );

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
        <CardHeader className="flex flex-col items-center text-center">
          <CardTitle className="text-2xl font-bold">{workshop.name}</CardTitle>
          <CardDescription className="text-gray-600 max-w-2xl mx-auto">
            {workshop.description}
          </CardDescription>

          {/* Admin Only: View Users Button */}
          {isAdmin && (
            <div className="flex items-center gap-2 mt-4">
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                onClick={() =>
                  navigate(`/dashboard/admin/workshop/${workshop.id}/users`)
                }
              >
                <Users size={18} />
                View Users ({workshop.userCount})
              </Button>

              {isContinuation ? (
                <ConfirmButton
                  confirmTitle="Duplicate Workshop"
                  confirmDescription="This will open the Add Workshop form with the current workshop's details pre-filled. You can then add new dates and make any other changes before saving."
                  onConfirm={() => {
                    // Store the workshop data in localStorage for the add workshop page to use
                    localStorage.setItem(
                      "duplicateWorkshopData",
                      JSON.stringify({
                        id: workshop.id,
                        name: workshop.name,
                        description: workshop.description,
                        price: workshop.price,
                        location: workshop.location,
                        capacity: workshop.capacity || 10,
                        type: workshop.type,
                        prerequisites: workshop.prerequisites || [],
                        equipments: workshop.equipments || [],
                        // Exclude occurrences/dates
                        isContinuation: isContinuation,
                      })
                    );
                    // Navigate to the add workshop page
                    navigate("/addworkshop");
                  }}
                  buttonLabel="Duplicate"
                  buttonClassName="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
                />
              ) : (
                <Button
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
                  onClick={() => handleOfferAgain()}
                >
                  Offer Again
                </Button>
              )}
            </div>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Multi-day Workshop Dates
                </h2>
                <Badge
                  variant="outline"
                  className="bg-blue-50 border-blue-200 text-blue-700"
                >
                  {sortedOccurrences.length} Workshop Dates
                </Badge>
              </div>
              {/* New Box-Style UI for multi-day workshops */}
              <div className="border rounded-lg shadow-md bg-white p-4 mb-6">
                <div className="grid gap-3">
                  {sortedOccurrences.map((occ: any, index: number) => (
                    <div
                      key={occ.id}
                      className="flex items-center p-3 rounded-md bg-gray-50 border border-gray-200"
                      // className={`flex items-center p-3 rounded-md ${
                      //   occ.status === "cancelled"
                      //     ? "bg-red-50 border border-red-200"
                      //     : occ.status === "past"
                      //     ? "bg-gray-50 border border-gray-200"
                      //     : "bg-green-50 border border-green-200"
                      // }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-yellow-500 text-white text-xs mr-2">
                            {index + 1}
                          </span>
                          <p className="font-medium">
                            {new Date(occ.startDate).toLocaleDateString(
                              undefined,
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 ml-8">
                          {new Date(occ.startDate).toLocaleTimeString(
                            undefined,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}{" "}
                          {" - "}
                          {new Date(occ.endDate).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* <div>
              {occ.status === "cancelled" ? (
                <Badge className="bg-red-500 text-white">Cancelled</Badge>
              ) : occ.status === "past" ? (
                <Badge className="bg-gray-500 text-white">Past</Badge>
              ) : (
                <Badge className="bg-green-500 text-white">Active</Badge>
              )}
            </div> */}
                    </div>
                  ))}
                </div>
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
                        Workshop registration has passed
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
                                  Yes, Cancel Entire Workshop Registration
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
                    // CHANGE 2: Replace the Register button with a Confirm button
                    // This shows number of sessions being registered for
                    const activeOccurrences = sortedOccurrences.filter(
                      (occ: any) =>
                        occ.status !== "past" && occ.status !== "cancelled"
                    );

                    const earliestActiveOccurrence = activeOccurrences.reduce(
                      (earliest, current) => {
                        const currentDate = new Date(current.startDate);
                        const earliestDate = new Date(earliest.startDate);
                        return currentDate < earliestDate ? current : earliest;
                      },
                      activeOccurrences[0]
                    );

                    const withinCutoffPeriod = earliestActiveOccurrence
                      ? isWithinCutoffPeriod(
                          new Date(earliestActiveOccurrence.startDate),
                          workshop.registrationCutoff
                        )
                      : false;

                    return (
                      <>
                        {withinCutoffPeriod ? (
                          <div className="flex flex-col items-start gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg opacity-70"
                                      disabled={true}
                                    >
                                      Register for Entire Workshop
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  align="start"
                                  className="bg-amber-100 text-amber-800 border border-amber-300 p-2 max-w-xs"
                                >
                                  <p>
                                    Registration is closed. Registration cutoff
                                    is{" "}
                                    {formatCutoffTime(
                                      workshop.registrationCutoff
                                    )}{" "}
                                    before the first workshop session.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <div className="bg-amber-100 text-amber-800 border border-amber-300 rounded-md p-3 text-sm">
                              Registration is closed. Registration cutoff is{" "}
                              {formatCutoffTime(workshop.registrationCutoff)}{" "}
                              before the first workshop session.
                            </div>
                          </div>
                        ) : (
                          <ConfirmButton
                            confirmTitle="Register for Multi-Day Workshop"
                            confirmDescription={`You are registering for ${activeOccurrences.length} workshop sessions. All dates are included in this registration.`}
                            onConfirm={() => handleRegisterAll()}
                            buttonLabel={`Register for Entire Workshop (${activeOccurrences.length} Sessions)`}
                            buttonClassName="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                            disabled={!hasCompletedAllPrerequisites}
                          />
                        )}
                      </>
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
                {sortedOccurrences.map((occurrence: Occurrence) => {
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
                              Registration has past
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                                    onClick={() =>
                                      handleRegister(occurrence.id)
                                    }
                                    disabled={
                                      !hasCompletedAllPrerequisites ||
                                      isWithinCutoffPeriod(
                                        new Date(occurrence.startDate),
                                        workshop.registrationCutoff
                                      )
                                    }
                                  >
                                    Register
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {isWithinCutoffPeriod(
                                new Date(occurrence.startDate),
                                workshop.registrationCutoff
                              ) && (
                                <TooltipContent className="bg-amber-100 text-amber-800 border border-amber-300 p-2 max-w-xs">
                                  <p>
                                    Registration is closed. Registration cutoff
                                    is{" "}
                                    {formatCutoffTime(
                                      workshop.registrationCutoff
                                    )}{" "}
                                    before the workshop starts.
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
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
            <div className="mt-6 mb-8">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3 flex items-center">
                  <span className="bg-yellow-500 text-white p-1 rounded-md mr-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  Prerequisites Required
                </h2>

                <div className="space-y-3">
                  {prerequisiteWorkshops.map((prereq) => (
                    <div
                      key={prereq.id}
                      className={`flex items-center p-3 rounded-md ${
                        prereq.completed
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 mr-3 h-8 w-8 rounded-full flex items-center justify-center ${
                          prereq.completed ? "bg-green-500" : "bg-red-500"
                        } text-white`}
                      >
                        {prereq.completed ? "✓" : "!"}
                      </div>
                      <div className="flex-1">
                        <Link
                          to={`/dashboard/workshops/${prereq.id}`}
                          className={`font-medium hover:underline ${
                            prereq.completed ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {prereq.name}
                        </Link>
                        <p
                          className={`text-sm ${
                            prereq.completed ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {prereq.completed
                            ? "Completed"
                            : "Not completed - you must complete this workshop first"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {!hasCompletedAllPrerequisites && (
                  <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-md">
                    <div className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-amber-500 mt-0.5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <p className="font-medium text-amber-800">
                          Registration Blocked
                        </p>
                        <p className="text-amber-700 text-sm">
                          You cannot register for this workshop until you have
                          completed all prerequisites listed above.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
