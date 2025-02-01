import React from "react";
import WorkshopCard from "./workshopcard";

const workshops = [
  { id: 1, title: "Laser Cutting Basics", description: "Introduction to laser cutting", price: "$30", role: "INSTRUCTOR" },
  { id: 2, title: "3D Printing Workshop", description: "Learn 3D printing techniques", price: "Free", role: "PARTICIPANT" },
  { id: 3, title: "CNC Machining", description: "Advanced CNC machining skills", price: "$50", role: "INSTRUCTOR" },
];

export default function WorkshopList() {
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
