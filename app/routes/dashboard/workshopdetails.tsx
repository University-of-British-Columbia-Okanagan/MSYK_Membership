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
import { Users } from "lucide-react";

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

    if (isAdmin) {
      setPopupMessage("Admins cannot register for workshops.");
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
              <Users size={18} /> {/* Small Users Icon */}
              View Users ({workshop.userCount})
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

          {/* Available Dates Section */}
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
                    {/* Show Cancelled / Register Button */}
                    {occurrence.status === "cancelled" ? (
                      <Badge className="bg-red-500 text-white px-3 py-1">
                        Cancelled
                      </Badge>
                    ) : (
                      <>
                        {isOccurrenceRegistered ? (
                          <Badge className="bg-green-500 text-white px-3 py-1">
                            Registered
                          </Badge>
                        ) : (
                          !isAdmin && (
                            <Button
                              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                              onClick={() => handleRegister(occurrence.id)}
                              disabled={!hasCompletedAllPrerequisites}
                            >
                              Register
                            </Button>
                          )
                        )}
                      </>
                    )}
                    {/* Show "Offer Again" Button for Admins only */}
                    {occurrence.status === "past" && isAdmin && (
                      <Button
                        variant="outline"
                        className="text-green-600 border-green-500 hover:bg-green-50"
                        onClick={() => handleOfferAgain(occurrence.id)}
                      >
                        Offer Again
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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

          {/* Back to Workshops Button */}
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
