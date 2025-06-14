import { useLoaderData, useFetcher, useNavigate } from "react-router-dom";
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
import  { getEquipmentById, getAvailableSlots } from "../../models/equipment.server";
import { getRoleUser } from "~/utils/session.server";
import { useState, useEffect } from "react";
import { logger } from "~/logging/logger";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const currentUserRole = await getRoleUser(request);
  const equipmentId = parseInt(params.id);
  (equipmentId);
  const slots = await getAvailableSlots(equipmentId)
  const equipment = await getEquipmentById(equipmentId);
  if (!equipment) {
    logger.warn(`[User: ${currentUserRole?.userId}] Requested equipment not found`, { url: request.url });
    throw new Response("Equipment not found", { status: 404 });
  }
  logger.info(`[User: ${currentUserRole?.userId}] Requested equipment details fetched`, { url: request.url });
  return { equipment, slots, currentUserRole };
}

export default function EquipmentDetails() {
  const { equipment, currentUserRole } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

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
  }

  const handleDelete = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this equipment?");
    if (confirmed) {
      try {
        const response = await fetch(`/dashboard/equipment/delete/${equipment.id}`, {method: "DELETE"});
  
        const result = await response.json();
  
        if (result.success) {
          navigate(-1);
        } else {
          setPopupMessage(result.error || "Failed to delete equipment.");
          setShowPopup(true);
        }
      } catch (error) {
        logger.error("Failed to delete equipment:", error);
        setPopupMessage("An error occurred while deleting the equipment.");
        setShowPopup(true);
      }
    }
  };  

  return (
    <div className="max-w-3xl mx-auto p-6">
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
            Ensure proper handling of equipment. Misuse may lead to restrictions on further bookings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
