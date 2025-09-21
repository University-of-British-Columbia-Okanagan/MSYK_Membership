import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useFetcher } from "react-router";
import { FiMoreVertical } from "react-icons/fi";

interface WorkshopProps {
  id: number;
  name: string;
  description: string;
  price: number;
  displayPrice?: number;
  type: "workshop" | "orientation" | string;
  isAdmin: boolean;
  imageUrl?: string;
  priceRange?: { min: number; max: number } | null;
  hasPriceVariations?: boolean;
}

export default function WorkshopCard({
  id,
  name,
  description,
  price,
  type,
  isAdmin,
  imageUrl,
  displayPrice,
  priceRange,
  hasPriceVariations,
}: WorkshopProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Placeholder image
  const placeholderImage = "/images/gallerysectionimg3.avif";

  return (
    <Card className="w-full md:w-72 min-h-[350px] rounded-lg shadow-md flex flex-col justify-between relative border">
      {/* Image Section */}
      <div className="w-full h-40 bg-gray-200 rounded-t-lg overflow-hidden">
        <img
          src={imageUrl || placeholderImage}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Workshop Info */}
      <CardHeader className="px-4 pt-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{name}</CardTitle>

          {/* Three Dots Menu (Aligned Properly) */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="p-2 text-gray-600 hover:bg-gray-100"
                >
                  <FiMoreVertical size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => navigate(`/dashboard/editworkshop/${id}`)}
                >
                  Edit
                </DropdownMenuItem>
                {/* <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (
                      window.confirm(
                        "Are you sure you want to duplicate this workshop?"
                      )
                    ) {
                      fetcher.submit(
                        { workshopId: id, action: "duplicate" },
                        { method: "post" }
                      );
                    }
                  }}
                >
                  Duplicate
                </DropdownMenuItem> */}
                <DropdownMenuItem
                  onSelect={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this workshop?"
                      )
                    ) {
                      fetcher.submit(
                        { workshopId: id, action: "delete" },
                        { method: "post" }
                      );
                    }
                  }}
                  className="text-red-600 focus:bg-red-50"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Description Section */}
        <CardDescription className="text-blue-700 mt-1">
          {description}
        </CardDescription>

        {/* Price Box */}
        <div className="mt-3 flex justify-start">
          <span className="border border-purple-500 text-purple-700 font-semibold text-lg px-3 py-1 rounded-md">
            {hasPriceVariations &&
            priceRange &&
            priceRange.min !== priceRange.max
              ? `$${priceRange.min} - $${priceRange.max}`
              : `$${displayPrice !== undefined ? displayPrice : price}`}
          </span>
        </div>
      </CardHeader>

      <CardContent className="mt-auto">
        <Button
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
          onClick={() => navigate(`/dashboard/workshops/${id}`)}
        >
          {type === "orientation" ? "View Orientation" : "View Workshop"}
        </Button>
      </CardContent>
    </Card>
  );
}
