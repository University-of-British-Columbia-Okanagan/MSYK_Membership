import { useLoaderData, Link } from "react-router-dom";
import { json } from "@remix-run/node";
import { getAvailableEquipment } from "../../models/equipment.server";

export async function loader() {
  return json({ equipment: await getAvailableEquipment() });
}

export default function Equipments() {
  const { equipment } = useLoaderData();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Available Equipment</h1>
      <div className="grid grid-cols-3 gap-4">
        {equipment.map((equip) => (
          <div key={equip.id} className="bg-white shadow-lg p-4 rounded-md">
            <h2 className="text-lg font-bold">{equip.name}</h2>
            <p className="text-sm text-gray-600">{equip.description}</p>
            <p className="text-sm font-semibold">Availability: {equip.availability ? "✅ Available" : "❌ Unavailable"}</p>
            <Link
              to={`/dashboard/equipments/${equip.id}`}
              className="mt-4 inline-block bg-yellow-500 text-white px-4 py-2 rounded-md"
            >
              View Equipment
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
