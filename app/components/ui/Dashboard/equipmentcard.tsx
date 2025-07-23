import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useFetcher } from "react-router-dom";
import { MoreVertical, Edit, Trash, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface EquipmentProps {
  id: number;
  name: string;
  description: string;
  imageUrl?: string;
  status: "available" | "booked" | "unavailable";
  bookingId?: number;
  isAdmin?: boolean;
}

const SAMPLE_IMAGE = "/images/Fabricationservicesimg.avif";

export default function EquipmentCard({
  id,
  name,
  description,
  status,
  imageUrl,
  bookingId,
  isAdmin = false,
}: EquipmentProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Handle Delete Equipment
  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${name}"?`
    );
    if (confirmDelete) {
      fetcher.submit({ equipmentId: id, action: "delete" }, { method: "post" });
    }
  };

  // Handle Duplicate Equipment
  const handleDuplicate = async () => {
    fetcher.submit(
      { equipmentId: id, action: "duplicate" },
      { method: "post" }
    );
  };

  // Handle Cancel Equipment Booking
  const handleCancel = async () => {
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel booking for "${name}"?`
    );
    if (confirmCancel && bookingId) {
      fetcher.submit({ bookingId, action: "cancel" }, { method: "post" });
    }
  };

  return (
    <Card
      className={`w-full md:w-80 rounded-lg shadow-md flex flex-col overflow-hidden relative ${
        status === "unavailable" ? "opacity-50" : ""
      }`}
    >
      {/* Unavailable Badge */}
      {status === "unavailable" && (
        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded z-10">
          Unavailable
        </div>
      )}

      {/* Three Dots Menu */}
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger className="absolute top-3 right-3 z-10">
            <MoreVertical
              size={20}
              className="text-gray-500 hover:text-gray-700"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => navigate(`/dashboard/equipments/edit/${id}`)}
            >
              <Edit className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-500 hover:bg-red-100"
              onSelect={handleDelete}
            >
              <Trash className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDuplicate}>
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Image Section */}
      <div className="h-40 w-full bg-gray-100 flex items-center justify-center overflow-hidden">
        <img
          src={imageUrl || SAMPLE_IMAGE}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>

      <CardHeader className="p-4">
        <CardTitle className="text-lg font-semibold">{name}</CardTitle>
        <CardDescription className="line-clamp-2 text-sm">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4">
        {/* Status Badge */}
        <span
          className={`text-sm font-medium px-3 py-1 rounded-lg w-fit ${
            status === "available"
              ? "bg-gray-100 text-gray-700"
              : status === "booked"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {status === "available"
            ? "Available"
            : status === "booked"
            ? "Booked"
            : "Unavailable"}
        </span>
        {/* Cancel Booking Button - Only shown if booked */}
        {status === "booked" && (
          <Button
            className="w-full bg-red-500 hover:bg-red-600 text-white"
            onClick={handleCancel}
          >
            Cancel Booking
          </Button>
        )}

        <Button
          className={`w-full text-white ${
            status === "unavailable" && !isAdmin
              ? "bg-gray-400 cursor-not-allowed"
              : status === "unavailable" && isAdmin
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-yellow-500 hover:bg-yellow-600"
          }`}
          onClick={() => {
            // Only navigate if equipment is available OR user is admin
            if (status !== "unavailable" || isAdmin) {
              navigate(`/dashboard/equipments/${id}`);
            }
          }}
          disabled={status === "unavailable" && !isAdmin}
        >
          {status === "unavailable"
            ? isAdmin
              ? "View Equipment (Admin)"
              : "View Equipment"
            : "View Equipment"}
        </Button>
      </CardContent>
    </Card>
  );
}
