import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useFetcher } from "react-router";
import { FiEdit, FiTrash2 } from "react-icons/fi"; // Import Icons

interface WorkshopProps {
  id: number;
  name: string;
  description: string;
  price: number;
  isAdmin: boolean;
}

export default function WorkshopCard({ id, name, description, price, isAdmin }: WorkshopProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="w-full md:w-80 min-h-[260px] rounded-lg shadow-md flex flex-col justify-between relative">
      {isAdmin && (
        <div className="absolute top-3 right-3 flex space-x-2">
          {/* Edit Button - Small Icon */}
          <Button
            size="icon"
            variant="outline"
            className="p-2 text-yellow-500 hover:bg-yellow-100"
            onClick={() => navigate(`/editworkshop/${id}`)}
          >
            <FiEdit size={18} />
          </Button>

          {/* Delete Button - Small Icon */}
          <fetcher.Form method="post">
            <input type="hidden" name="workshopId" value={id} />
            <Button
              type="submit"
              name="action"
              value="delete"
              size="icon"
              variant="outline"
              className="p-2 text-red-500 hover:bg-red-100"
              onClick={(e) => {
                e.preventDefault();
                if (window.confirm("Are you sure you want to delete this workshop?")) {
                  setConfirmDelete(true);
                  fetcher.submit({ workshopId: id, action: "delete" }, { method: "post" });
                }
              }}
            >
              <FiTrash2 size={18} />
            </Button>
          </fetcher.Form>
        </div>
      )}

      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-grow">
        <p className="text-lg font-semibold text-gray-900">Price: ${price}</p>

        {/* Align View Button to Bottom */}
        <div className="mt-auto">
          <Button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => navigate(`/dashboard/workshops/${id}`)}
          >
            View Workshop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
