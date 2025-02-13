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

interface WorkshopProps {
  id: number; // Add ID to uniquely identify each workshop
  name: string;
  description: string;
  price: number;
}

export default function WorkshopCard({ id, name, description, price }: WorkshopProps) {
  const navigate = useNavigate(); // React Router hook for navigation

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
      </CardContent>
    </Card>
  );
}
