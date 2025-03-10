// workshoplist.tsx
import React from "react";
import WorkshopCard from "./workshopcard";

interface Workshop {
  id: number;
  name: string;
  description: string;
  price: number;
  type: string;
  occurrences: { id: number; startDate: string; endDate: string }[];
  isRegistered: boolean; // <-- Make sure this is included
}

interface WorkshopListProps {
  title: string;
  workshops: Workshop[];
  isAdmin: boolean;
}

export default function WorkshopList({
  title,
  workshops,
  isAdmin,
}: WorkshopListProps) {
  const now = new Date();

  console.log("hello");
  console.log(workshops);

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
        {workshops.map((workshop) => {
          const isPast = workshop.occurrences.every(
            (occurrence) => new Date(occurrence.endDate) < now
          );

          return (
            <WorkshopCard
              key={workshop.id}
              // Spread in basic workshop props:
              {...workshop}
              // Then explicitly pass what you need:
              isAdmin={isAdmin}
              isPast={isPast}
              // isRegistered is definitely passed:
              isRegistered={workshop.isRegistered}
            />
          );
        })}
      </div>
    </div>
  );
}
