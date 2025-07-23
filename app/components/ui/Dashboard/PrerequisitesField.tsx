import React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Workshop {
  id: number;
  name: string;
  type: string;
}

export interface PrerequisitesFieldProps {
  control: any;
  availableWorkshops: Workshop[];
  selectedPrerequisites: number[];
  handlePrerequisiteSelect: (workshopId: number) => void;
  removePrerequisite: (workshopId: number) => void;
  /**
   * Optional current workshop id. When provided, it is filtered out.
   */
  currentWorkshopId?: number;
  error?: string | React.ReactNode;
}

const PrerequisitesField: React.FC<PrerequisitesFieldProps> = ({
  control,
  availableWorkshops,
  selectedPrerequisites,
  handlePrerequisiteSelect,
  removePrerequisite,
  currentWorkshopId,
  error,
}) => {
  // Sort selected prerequisites for consistent display.
  const sortedSelected = [...selectedPrerequisites].sort((a, b) => a - b);

  // Filter available workshops:
  // - Only include workshops whose type is "orientation"
  // - Filter out any already selected workshops
  // - If currentWorkshopId is provided, filter it out as well
  const filteredWorkshops = availableWorkshops.filter((workshop) => {
    if (workshop.type.toLowerCase() !== "orientation") return false;
    if (currentWorkshopId !== undefined && workshop.id === currentWorkshopId) {
      return false;
    }
    return !selectedPrerequisites.includes(workshop.id);
  });

  return (
    <FormField
      control={control}
      name="prerequisites"
      render={() => (
        <FormItem>
          <FormLabel>Prerequisites</FormLabel>
          <FormControl>
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {sortedSelected.map((prereqId) => {
                  const workshop = availableWorkshops.find(
                    (w) => w.id === prereqId
                  );
                  return workshop ? (
                    <Badge
                      key={prereqId}
                      variant="secondary"
                      className="py-1 px-2"
                    >
                      {workshop.name}
                      <button
                        type="button"
                        onClick={() => removePrerequisite(prereqId)}
                        className="ml-2 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <Select
                onValueChange={(value) =>
                  handlePrerequisiteSelect(Number(value))
                }
                value=""
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select prerequisites..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredWorkshops
                    .sort((a, b) => a.id - b.id)
                    .map((workshop) => (
                      <SelectItem
                        key={workshop.id}
                        value={workshop.id.toString()}
                      >
                        {workshop.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </FormControl>
          <FormMessage>{error}</FormMessage>
          <div className="text-xs text-gray-500 mt-1">
            Select workshops of type Orientation that must be completed before enrolling.
          </div>
        </FormItem>
      )}
    />
  );
};

export default PrerequisitesField;
