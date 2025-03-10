// workshopcard.tsx
import React from "react";
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
  type: "workshop" | "orientation" | string;
  isAdmin: boolean;
  isRegistered?: boolean;
  isPast?: boolean;
}

export default function WorkshopCard({
  id,
  name,
  description,
  price,
  type,
  isAdmin,
  isRegistered = false, // default to false if not provided
  isPast,
}: WorkshopProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  return (
    <Card className="w-full md:w-80 min-h-[260px] rounded-lg shadow-md flex flex-col justify-between relative">
      {isAdmin && (
        <div className="absolute top-3 right-3 flex space-x-2">
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
              <DropdownMenuItem onSelect={() => navigate(`/editworkshop/${id}`)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  if (
                    window.confirm("Are you sure you want to duplicate this workshop?")
                  ) {
                    fetcher.submit(
                      { workshopId: id, action: "duplicate" },
                      { method: "post" }
                    );
                  }
                }}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (
                    window.confirm("Are you sure you want to delete this workshop?")
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
        </div>
      )}

      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-grow">
        <p className="text-lg font-semibold text-gray-900">Price: ${price}</p>

        {/* Show Registration Status */}
        {isPast ? (
          <p className="text-gray-500 font-medium text-md">EXPIRED</p>
        ) : isRegistered ? (
          <p className="text-green-600 font-medium text-md">REGISTERED</p>
        ) : (
          <p className="text-red-500 font-medium text-md">NOT REGISTERED</p>
        )}

        <div className="mt-auto">
          {/* Existing "View Workshop" or "View Orientation" Button */}
          <Button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => navigate(`/dashboard/workshops/${id}`)}
          >
            {type === "orientation" ? "View Orientation" : "View Workshop"}
          </Button>

          {/* New "View Users" Button for Admins */}
          {isAdmin && (
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white mt-2"
              onClick={() => navigate(`/dashboard/admin/workshop/${id}/users`)}
            >
              View Users
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
