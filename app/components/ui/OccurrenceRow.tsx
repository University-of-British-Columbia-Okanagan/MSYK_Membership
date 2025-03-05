import React from "react";
import { Input } from "@/components/ui/input";

export interface Occurrence {
  startDate: Date;
  endDate: Date;
  // You can add additional fields if needed.
}

export interface OccurrenceRowProps {
  index: number;
  occurrence: Occurrence;
  updateOccurrence: (
    index: number,
    field: "startDate" | "endDate",
    value: string
  ) => void;
  formatLocalDatetime: (date: Date) => string;
}

const OccurrenceRow: React.FC<OccurrenceRowProps> = ({
  index,
  occurrence,
  updateOccurrence,
  formatLocalDatetime,
}) => {
  return (
    <div className="flex gap-2 items-center mb-2 w-full">
      <Input
        type="datetime-local"
        step="900"
        value={
          isNaN(occurrence.startDate.getTime())
            ? ""
            : formatLocalDatetime(occurrence.startDate)
        }
        onChange={(e) =>
          updateOccurrence(index, "startDate", e.target.value)
        }
        className="flex-1"
      />
      <Input
        type="datetime-local"
        step="900"
        value={
          isNaN(occurrence.endDate.getTime())
            ? ""
            : formatLocalDatetime(occurrence.endDate)
        }
        onChange={(e) =>
          updateOccurrence(index, "endDate", e.target.value)
        }
        className="flex-1"
      />
    </div>
  );
};

export default OccurrenceRow;
