import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useFetcher } from "react-router";
import { FiMoreVertical } from "react-icons/fi";

interface WorkshopProps {
  id: number;
  name: string;
  description: string;
  price: number;
  displayPrice?: number;
  type: "workshop" | "orientation" | string;
  isAdmin: boolean;
  imageUrl?: string;
  priceRange?: { min: number; max: number } | null;
  hasPriceVariations?: boolean;
  isMyWorkshops?: boolean;
  registrationStartDate?: Date | string;
  registrationEndDate?: Date | string;
}

export default function WorkshopCard({
  id,
  name,
  description,
  price,
  type,
  isAdmin,
  imageUrl,
  displayPrice,
  priceRange,
  hasPriceVariations,
  isMyWorkshops = false,
  registrationStartDate,
  registrationEndDate,
}: WorkshopProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Placeholder image
  const placeholderImage = "/images/gallerysectionimg3.avif";

  return (
    <Card className="w-full md:w-72 flex-none min-h-[350px] rounded-lg shadow-md flex flex-col justify-between relative border">
      {/* Image Section */}
      <div className="w-full h-40 bg-gray-200 rounded-t-lg overflow-hidden">
        <img
          src={imageUrl || placeholderImage}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Workshop Info */}
      <CardHeader className="px-4 pt-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{name}</CardTitle>

          {/* Three Dots Menu (Aligned Properly) */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="p-2 text-gray-600 hover:bg-gray-100"
                >
                  <FiMoreVertical size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => navigate(`/dashboard/editworkshop/${id}`)}
                >
                  Edit
                </DropdownMenuItem>
                {/* <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (
                      window.confirm(
                        "Are you sure you want to duplicate this workshop?"
                      )
                    ) {
                      fetcher.submit(
                        { workshopId: id, action: "duplicate" },
                        { method: "post" }
                      );
                    }
                  }}
                >
                  Duplicate
                </DropdownMenuItem> */}
                <DropdownMenuItem
                  onSelect={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this workshop?"
                      )
                    ) {
                      fetcher.submit(
                        { workshopId: id, action: "delete" },
                        { method: "post" }
                      );
                    }
                  }}
                  className="text-red-600 focus:bg-red-50"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Description Section */}
        <CardDescription className="text-blue-700 mt-1">
          {description}
        </CardDescription>

        {/* Price Box or Registration Time */}
        {isMyWorkshops && registrationStartDate && registrationEndDate ? (
          <div className="mt-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">
                  Registration Time
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {(() => {
                  const start = new Date(registrationStartDate);
                  const end = new Date(registrationEndDate);

                  const formatDate = (date: Date) =>
                    date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                  const formatTime = (date: Date) =>
                    date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });

                  const isSameDay = start.toDateString() === end.toDateString();

                  if (isSameDay) {
                    return (
                      <>
                        <div className="font-medium">{formatDate(start)}</div>
                        <div>
                          {formatTime(start)} - {formatTime(end)}
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <div>
                          {formatDate(start)} {formatTime(start)}
                        </div>
                        <div>
                          to {formatDate(end)} {formatTime(end)}
                        </div>
                      </>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-start">
            <span className="border border-purple-500 text-purple-700 font-semibold text-lg px-3 py-1 rounded-md">
              {hasPriceVariations &&
              priceRange &&
              priceRange.min !== priceRange.max
                ? `$${priceRange.min} - $${priceRange.max}`
                : `$${displayPrice !== undefined ? displayPrice : price}`}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="mt-auto">
        <Button
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={() => navigate(`/dashboard/workshops/${id}`)}
        >
          {type === "orientation" ? "View Orientation" : "View Workshop"}
        </Button>
      </CardContent>
    </Card>
  );
}
