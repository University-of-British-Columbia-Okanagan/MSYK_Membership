import React from "react";
import WorkshopCard from "./workshopcard";
import { useLoaderData } from "react-router";

export default function WorkshopList({ workshops }: { workshops: { id: number; name: string; description: string; price: number }[] }) {
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Registered Workshops</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {workshops.map((workshop) => (
          <WorkshopCard key={workshop.id} {...workshop} />
        ))}
      </div>
    </div>
  );
}
