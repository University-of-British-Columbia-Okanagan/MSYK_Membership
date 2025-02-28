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
    <Card className="w-full md:w-80 min-h-[200px] rounded-lg shadow-md flex flex-col justify-between relative">
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-grow">
        {/* Availability Text in Green */}
        <p className={`font-medium text-md ${availability ? "text-green-600" : "text-red-500"}`}>
          {availability ? "AVAILABLE" : "Not Available"}
        </p>

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
