import React from "react";
import EquipmentCard from "./equipmentcard";

interface Equipment {
  id: number;
  name: string;
  description: string;
  availability: boolean;
}

export default function EquipmentList({ equipments }: { equipments: Equipment[] }) {
  console.log("Rendering Equipments:", equipments);

  if (!equipments || !Array.isArray(equipments) || equipments.length === 0) {
    return <p>No Equipment Available</p>;
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Available Equipment</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
        {equipments.map((equipment) => (
          <EquipmentCard key={equipment.id} {...equipment} />
        ))}
      </div>
    </div>
  );
}
