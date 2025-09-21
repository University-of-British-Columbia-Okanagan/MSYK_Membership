import WorkshopCard from "./workshopcard";

interface Workshop {
  id: number;
  name: string;
  description: string;
  displayPrice?: number;
  price: number;
  type: string;
  occurrences: { id: number; startDate: string; endDate: string }[];
  isRegistered: boolean;
  priceRange?: { min: number; max: number } | null;
  hasPriceVariations?: boolean;
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
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-bold mb-6">{title}</h2>
      <div className="flex flex-wrap gap-4 md:gap-6 justify-start items-stretch">
        {workshops.map((workshop) => {
          return (
            <WorkshopCard key={workshop.id} {...workshop} isAdmin={isAdmin} />
          );
        })}
      </div>
    </div>
  );
}
