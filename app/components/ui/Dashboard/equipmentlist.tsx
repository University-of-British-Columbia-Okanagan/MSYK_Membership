import EquipmentCard from "./EquipmentCard";

interface Equipment {
  id: number;
  name: string;
  description: string;
  availability: boolean;
  status: "available" | "booked" | "unavailable";
  imageUrl?: string;
  bookingId?: number;
}

export default function EquipmentList({
  equipments,
  isAdmin,
}: {
  equipments: Equipment[];
  isAdmin: boolean;
}) {
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Available Equipment</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
        {equipments.map((equipment) => (
          <EquipmentCard key={equipment.id} {...equipment} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}
