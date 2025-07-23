import WorkshopCard from "./workshopcard";

interface Workshop {
  id: number;
  name: string;
  description: string;
  price: number;
  type: string;
  occurrences: { id: number; startDate: string; endDate: string }[];
  isRegistered: boolean;
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
              {...workshop}
              isAdmin={isAdmin}
              isPast={isPast}
              isRegistered={workshop.isRegistered}
            />
          );
        })}
      </div>
    </div>
  );
}
