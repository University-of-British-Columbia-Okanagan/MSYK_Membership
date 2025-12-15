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
import { useState } from "react";

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
  registeredOccurrences?: Array<{
    id: number;
    startDate?: Date | string;
    endDate?: Date | string;
  }>;
  isMultiDay?: boolean;
  priceVariation?: {
    id: number;
    name: string;
    price: number;
    description?: string;
  } | null;
}

// Helper component for single session display
function SingleSessionDisplay({ occurrence }: { occurrence: any }) {
  if (!occurrence?.startDate || !occurrence?.endDate) return null;

  const start = new Date(occurrence.startDate);
  const end = new Date(occurrence.endDate);

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
}

// Helper component for multi-day session display with collapse/expand
function MultiDaySessionDisplay({
  registeredOccurrences,
}: {
  registeredOccurrences: any[];
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY_COUNT = 3;

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

  const displayedOccurrences = showAll
    ? registeredOccurrences
    : registeredOccurrences.slice(0, INITIAL_DISPLAY_COUNT);

  const hasMore = registeredOccurrences.length > INITIAL_DISPLAY_COUNT;

  return (
    <div className="space-y-2">
      {displayedOccurrences.map((occ, index) => {
        if (!occ.startDate || !occ.endDate) return null;

        const start = new Date(occ.startDate);
        const end = new Date(occ.endDate);

        return (
          <div
            key={occ.id || index}
            className="pb-2 border-b border-blue-100 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-semibold">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="font-medium text-blue-800">
                  {formatDate(start)}
                </div>
                <div className="text-gray-600">
                  {formatTime(start)} - {formatTime(end)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline w-full text-center pt-1"
        >
          {showAll
            ? "Show less"
            : `Show all ${registeredOccurrences.length} sessions`}
        </button>
      )}
    </div>
  );
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
  registeredOccurrences = [],
  isMultiDay = false,
  priceVariation,
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
        <div className="mt-1">
          <CardDescription className="text-blue-700">
            {description.length <= 299
              ? description
              : `${description.slice(0, 299)}...`}
          </CardDescription>
          {description.length > 299 && (
            <button
              onClick={() => navigate(`/dashboard/workshops/${id}`)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-1 hover:underline"
            >
              Show more
            </button>
          )}
        </div>

        {/* Price Box or Registration Time */}
        {isMyWorkshops && registeredOccurrences.length > 0 ? (
          <div className="mt-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">
                  {isMultiDay
                    ? `Registration Dates (${registeredOccurrences.length} ${registeredOccurrences.length === 1 ? "Session" : "Sessions"})`
                    : "Registration Time"}
                </span>
              </div>

              {/* Price Variation Info - Inside same box */}
              {priceVariation && (
                <div className="mb-3 pb-3 border-b border-blue-200">
                  <div className="text-xs text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-700">
                        {priceVariation.name}
                      </span>
                      <span className="text-purple-700 font-bold">
                        ${priceVariation.price}
                      </span>
                    </div>
                    {priceVariation.description && (
                      <div className="text-gray-600 mt-1">
                        {priceVariation.description}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Registration Dates */}
              <div className="text-xs text-gray-600">
                {isMultiDay ? (
                  <MultiDaySessionDisplay
                    registeredOccurrences={registeredOccurrences}
                  />
                ) : (
                  <SingleSessionDisplay occurrence={registeredOccurrences[0]} />
                )}
              </div>
            </div>
          </div>
        ) : !isMyWorkshops ? (
          <div className="mt-3 flex justify-start">
            <span className="border border-purple-500 text-purple-700 font-semibold text-lg px-3 py-1 rounded-md">
              {hasPriceVariations &&
              priceRange &&
              priceRange.min !== priceRange.max
                ? `$${priceRange.min} - $${priceRange.max}`
                : `$${displayPrice !== undefined ? displayPrice : price}`}
            </span>
          </div>
        ) : null}
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
