import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WorkshopProps {
  title: string;
  description: string;
  price: string; // Example: "$50" or "Free"
}

export default function WorkshopCard({ title, description, price}: WorkshopProps) {
  return (
    <Card className="w-full md:w-80 rounded-lg shadow-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg font-semibold text-gray-900">Price: {price}</p>
        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">View Workshop</Button>
      </CardContent>
    </Card>
  );
}
