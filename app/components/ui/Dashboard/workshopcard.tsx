import React, { useState }  from "react";
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

interface WorkshopProps {
  id: number; // Add ID to uniquely identify each workshop
  name: string;
  description: string;
  price: number;
  isAdmin : boolean;
}

export default function WorkshopCard({ id, name, description, price, isAdmin }: WorkshopProps) {
  const navigate = useNavigate(); // React Router hook for navigation
  const fetcher = useFetcher();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="w-full md:w-80 rounded-lg shadow-md">
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg font-semibold text-gray-900">Price: {price}</p>
        <Button 
          className="w-full bg-yellow-500 hover:bg-yellow text-white"
          onClick={() => navigate(`/dashboard/workshops/${id}`)} 
        >
          View Workshop
        </Button>

        {/* Admin Buttons */}
        {isAdmin && (
          <fetcher.Form method="post">
            <input type="hidden" name="workshopId" value={id} />
            <input type="hidden" name="confirmationDelete" value={confirmDelete ? "confirmed" : "pending"} />
            <div className="flex justify-center mt-2">
              <Button
                type="submit"
                name="action"
                value="edit"
                className="bg-yellow-500 hover:bg-yellow-600 text-white mx-4 px-4 py-2 rounded-md shadow"
              >
                Edit
              </Button>
              <Button
                type="submit"
                name="action"
                value="delete"
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow"
                onClick={(e) => {
                  e.preventDefault();
                  if (window.confirm("Are you sure you want to delete this workshop?")) {
                    setConfirmDelete(true);
                    fetcher.submit({ workshopId: id, action: "delete", confirmation: "confirmed" }, { method: "post" });
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </fetcher.Form>
        )}
      </CardContent>
    </Card>
  );
}
