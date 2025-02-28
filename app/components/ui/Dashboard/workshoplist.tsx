import React from "react";
import WorkshopCard from "./workshopcard";

interface Workshop {
  id: number;
  name: string;
  description: string;
  price: number;
  occurrences: { id: number; startDate: string; endDate: string }[];
}

export default function WorkshopList({ workshops, isAdmin }: { workshops: Workshop[]; isAdmin: boolean }) {
  const now = new Date(); // Get the current date

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Workshops</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
        {workshops.map((workshop) => {
       
          const isPast = workshop.occurrences.every(
            (occurrence) => new Date(occurrence.endDate) < now
          );

          return (
            <WorkshopCard
              key={workshop.id}
              {...workshop}
              isAdmin={isAdmin}
              isPast={isPast} 
            />
          );
        })}
      </div>
    </div>
  );
}
