import { useLoaderData, useFetcher, useNavigate } from "react-router";
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
  getEquipmentById,
  getAvailableSlots,
} from "../../models/equipment.server";
import { getRoleUser } from "~/utils/session.server";
import { useState, useEffect } from "react";
import { getUserCompletedEquipmentPrerequisites } from "../../models/equipment.server";
import { getUser } from "~/utils/session.server";
import { getWorkshopById } from "../../models/workshop.server";
import { Link } from "react-router";
import { SidebarProvider } from "~/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import { ArrowLeft } from "lucide-react";
import { logger } from "~/logging/logger";

interface PrerequisiteWorkshop {
  id: number;
  name: string;
  completed: boolean;
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const currentUserRole = await getRoleUser(request);
  const user = await getUser(request);
  const equipmentId = parseInt(params.id);
  const slots = await getAvailableSlots(equipmentId);
  const equipment = await getEquipmentById(equipmentId);
  if (!equipment) {
    logger.warn(
      `[User: ${currentUserRole?.userId}] Requested equipment not found`,
      { url: request.url }
    );
    throw new Response("Equipment not found", { status: 404 });
  }

  let prerequisiteWorkshops: PrerequisiteWorkshop[] = [];
  let hasCompletedAllPrerequisites = true;

  if (user && equipment.prerequisites && equipment.prerequisites.length > 0) {
    // Get completed prerequisites for this user
    const completedPrerequisites = await getUserCompletedEquipmentPrerequisites(
      user.id,
      equipmentId
    );

    // Fetch prerequisite workshop details
    prerequisiteWorkshops = await Promise.all(
      equipment.prerequisites.map(async (prereqId) => {
        const prereqWorkshop = await getWorkshopById(prereqId);
        const isCompleted = completedPrerequisites.includes(prereqId);

        return prereqWorkshop
          ? { id: prereqId, name: prereqWorkshop.name, completed: isCompleted }
          : {
              id: prereqId,
              name: `Workshop #${prereqId}`,
              completed: isCompleted,
            };
      })
    );

    hasCompletedAllPrerequisites = prerequisiteWorkshops.every(
      (prereq) => prereq.completed
    );
  } else if (equipment.prerequisites && equipment.prerequisites.length > 0) {
    // User not logged in, show prerequisites as not completed
    prerequisiteWorkshops = await Promise.all(
      equipment.prerequisites.map(async (prereqId) => {
        const prereqWorkshop = await getWorkshopById(prereqId);
        return prereqWorkshop
          ? { id: prereqId, name: prereqWorkshop.name, completed: false }
          : { id: prereqId, name: `Workshop #${prereqId}`, completed: false };
      })
    );
    hasCompletedAllPrerequisites = false;
  }

  logger.info(
    `[User: ${currentUserRole?.userId}] Requested equipment details fetched`,
    { url: request.url }
  );
  return {
    equipment,
    slots,
    currentUserRole,
    user,
    prerequisiteWorkshops,
    hasCompletedAllPrerequisites,
  };
}

export default function EquipmentDetails() {
  const {
    equipment,
    currentUserRole,
    user,
    prerequisiteWorkshops,
    hasCompletedAllPrerequisites,
  } = useLoaderData() as {
    equipment: any;
    currentUserRole: any;
    user: any;
    prerequisiteWorkshops: PrerequisiteWorkshop[];
    hasCompletedAllPrerequisites: boolean;
  };
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  const isAdmin = currentUserRole?.roleName === "Admin";

  useEffect(() => {
    if (fetcher.data?.success) {
      setPopupMessage("🎉 Equipment booked successfully!");
      setShowPopup(true);
    } else if (fetcher.data?.error) {
      setPopupMessage(fetcher.data.error);
      setShowPopup(true);
    }
  }, [fetcher.data]);

  const handleBooking = () => {
    navigate(`/dashboard/equipmentbooking/${equipment.id}`);
  };

  const handleEditing = () => {
    navigate(`/dashboard/equipment/edit/${equipment.id}`);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this equipment?"
    );
    if (confirmed) {
      try {
        const response = await fetch(
          `/dashboard/equipment/delete/${equipment.id}`,
          { method: "DELETE" }
        );

        const result = await response.json();

        if (result.success) {
          navigate(-1);
        } else {
          setPopupMessage(result.error || "Failed to delete equipment.");
          setShowPopup(true);
        }
      } catch (error) {
        setPopupMessage("An error occurred while deleting the equipment.");
        setShowPopup(true);
      }
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {/* Conditional sidebar rendering */}
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}

        {/* Main content area */}
        <main className="flex-grow p-6 overflow-auto">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/equipments")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Equipments
              </Button>
            </div>
            {showPopup && (
              <div className="fixed top-4 right-4 p-4 bg-green-500 text-white rounded-lg shadow-lg">
                {popupMessage}
              </div>
            )}

            <Card className="mt-6">
              <div className="flex items-center justify-between">
                <CardHeader>
                  <CardTitle className="text-2xl">{equipment.name}</CardTitle>
                  <CardDescription>{equipment.description}</CardDescription>
                </CardHeader>
                {currentUserRole && currentUserRole.roleName === "Admin" && (
                  <Button
                    className="bg-red-600 text-white w-max mr-5"
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                )}
              </div>

              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {equipment.availability ? "Available" : "Unavailable"}
                  </Badge>
                </div>

                <Separator className="my-6" />

                {/* Prerequisites Section */}
                {prerequisiteWorkshops.length > 0 && (
                  <>
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
                                  prereq.completed
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                } text-white`}
                              >
                                {prereq.completed ? "✓" : "!"}
                              </div>
                              <div className="flex-1">
                                <Link
                                  to={`/dashboard/workshops/${prereq.id}`}
                                  className={`font-medium hover:underline ${
                                    prereq.completed
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {prereq.name}
                                </Link>
                                <p
                                  className={`text-sm ${
                                    prereq.completed
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {prereq.completed
                                    ? "Completed"
                                    : "Not completed - you must complete this orientation first"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Separator className="my-6" />
                  </>
                )}

                {/* Book + Edit Equipment */}
                <div className="flex gap-4">
                  <Button
                    className="flex-[3] bg-yellow-500 text-white"
                    onClick={handleBooking}
                    disabled={!equipment.availability}
                  >
                    {equipment.availability ? "Book Equipment" : "Unavailable"}
                  </Button>

                  {currentUserRole && currentUserRole.roleName === "Admin" && (
                    <Button
                      className="flex-[1] bg-slate-600 text-white"
                      onClick={handleEditing}
                    >
                      Edit
                    </Button>
                  )}
                </div>

                <Separator className="my-6" />

                <h2 className="text-lg font-semibold">Usage Policy</h2>
                <p className="text-gray-600">
                  Ensure proper handling of equipment. Misuse may lead to
                  restrictions on further bookings.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
