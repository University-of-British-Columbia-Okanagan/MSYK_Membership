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
  startTime?: Date;
  endTime?: Date;
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
  startTime,
  endTime,
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

  // Format time display
  const formatBookingTime = () => {
    if (!startTime || !endTime) return null;

    const start = new Date(startTime);
    const end = new Date(endTime);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    const isSameDay = start.toDateString() === end.toDateString();

    if (isSameDay) {
      return (
        <div className="text-xs text-gray-600">
          <div className="font-medium">{formatDate(start)}</div>
          <div>
            {formatTime(start)} - {formatTime(end)}
          </div>
        </div>
      );
    } else {
      return (
        <div className="text-xs text-gray-600">
          <div>
            {formatDate(start)} {formatTime(start)}
          </div>
          <div>
            to {formatDate(end)} {formatTime(end)}
          </div>
        </div>
      );
    }
  };

  return (
    <Card
      className={`w-full md:w-80 flex-none rounded-lg shadow-md flex flex-col overflow-hidden relative h-full ${
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
              onClick={() => navigate(`/dashboard/equipment/edit/${id}`)}
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

      <CardHeader className="p-4 flex-grow">
        <CardTitle className="text-lg font-semibold">{name}</CardTitle>
        <div>
          <CardDescription className="text-sm">
            {description.length <= 299
              ? description
              : `${description.slice(0, 299)}...`}
          </CardDescription>
          {description.length > 299 && (
            <button
              onClick={() => navigate(`/dashboard/equipments/${id}`)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-1 hover:underline"
            >
              Show more
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4 mt-auto">
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

        {/* Booking Time Display - Only shown if booked and time info available */}
        {status === "booked" && (startTime || endTime) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-900">
                Booking Time
              </span>
            </div>
            {formatBookingTime()}
          </div>
        )}

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
                : "bg-indigo-500 hover:bg-indigo-600"
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
