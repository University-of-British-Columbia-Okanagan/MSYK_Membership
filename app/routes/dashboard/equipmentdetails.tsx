import { useParams, useLoaderData, useFetcher, useNavigate } from "react-router-dom";
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
import  { getEquipmentById, getAvailableSlots} from "../../models/equipment.server";
import { useState, useEffect } from "react";

export async function loader({ params }: { params: { id: string } }) {
  const equipmentId = parseInt(params.id);
  (equipmentId);
  const slots = await getAvailableSlots(equipmentId)
  const equipment = await getEquipmentById(equipmentId);
  if (!equipment) {
    throw new Response("Equipment not found", { status: 404 });
  }
  return { equipment, slots };
}

export default function EquipmentDetails() {
  const { equipment } = useLoaderData();
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      {showPopup && (
        <div className="fixed top-4 right-4 p-4 bg-green-500 text-white rounded-lg shadow-lg">
          {popupMessage}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-2xl">{equipment.name}</CardTitle>
          <CardDescription>{equipment.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex gap-2">
            <Badge variant="outline">
              {equipment.availability ? "Available" : "Unavailable"}
            </Badge>
          </div>

          <Separator className="my-6" />

          {/* Book Equipment Button */}
          <Button
            className="w-full bg-yellow-500 text-white"
            onClick={handleBooking}
            disabled={!equipment.availability}
          >
            {equipment.availability ? "Book Equipment" : "Unavailable"}
          </Button>

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
