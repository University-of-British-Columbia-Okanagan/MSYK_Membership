import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface EquipmentProps {
  id: number;
  name: string;
  description: string;
  availability: boolean;
}

export default function EquipmentCard({ id, name, description, availability }: EquipmentProps) {
  const navigate = useNavigate();

  return (
    <Card className="w-full md:w-80 min-h-[220px] rounded-lg shadow-md flex flex-col justify-between">
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 flex-grow">
        <p className="text-md font-semibold">
          Availability: {availability ? "✅ Available" : "❌ Unavailable"}
        </p>

        {/* Align View Button to Bottom */}
        <div className="mt-auto">
          <Button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => navigate(`/dashboard/equipments/${id}`)}
          >
            View Equipment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
