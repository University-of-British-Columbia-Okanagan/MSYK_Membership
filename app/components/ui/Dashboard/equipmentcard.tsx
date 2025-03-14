import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useFetcher } from "react-router-dom";
import { MoreVertical, Edit, Trash, Copy, Image as ImageIcon } from "lucide-react";
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
  availability: boolean;
  imageUrl?: string;
  status: "available" | "booked";
}

const SAMPLE_IMAGE = "/images/Fabricationservicesimg.avif";

export default function EquipmentCard({
  id,
  name,
  description,
  availability,
  imageUrl,
}: EquipmentProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Handle Delete Equipment
  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${name}"?`
    );
    if (confirmDelete) {
      fetcher.submit(
        { equipmentId: id, action: "delete" },
        { method: "post" }
      );
    }
  };

  // Handle Duplicate Equipment
  const handleDuplicate = async () => {
    fetcher.submit(
      { equipmentId: id, action: "duplicate" },
      { method: "post" }
    );
  };

  return (
    <Card className="w-full md:w-80 rounded-lg shadow-md flex flex-col overflow-hidden relative">
      {/* Three Dots Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="absolute top-3 right-3">
          <MoreVertical size={20} className="text-gray-500 hover:text-gray-700" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => navigate(`/dashboard/equipments/edit/${id}`)}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-500 hover:bg-red-100" onSelect={handleDelete}>
            <Trash className="w-4 h-4 mr-2" /> Delete
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" /> Duplicate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
        <CardDescription className="line-clamp-2 text-sm">{description}</CardDescription>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4">
        {/* Availability Badge */}
       {/* Status Badge - Change based on My Equipments or All Equipments */}
       <span
          className={`text-sm font-medium px-3 py-1 rounded-lg w-fit ${
            status === "available" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {status === "available" ? "Available" : "Booked"}
        </span>

        <Button
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
          onClick={() => navigate(`/dashboard/equipments/${id}`)}
        >
          View Equipment
        </Button>
      </CardContent>
    </Card>
  );
}
