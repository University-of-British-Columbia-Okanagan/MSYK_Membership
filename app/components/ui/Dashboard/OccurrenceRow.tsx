import React from "react";
import { Input } from "@/components/ui/input";
import { TimeIntervalPicker } from "./TimeIntervalPicker";
import { cn } from "@/lib/utils"; // Make sure to import cn

export interface Occurrence {
  startDate: Date;
  endDate: Date;
  status?: string;
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
  className?: string;
  disabled?: boolean;
}

const OccurrenceRow: React.FC<OccurrenceRowProps> = ({
  index,
  occurrence,
  updateOccurrence,
  formatLocalDatetime,
  className,
  disabled = false,
}) => {
  // Determine if a valid date has been selected for each occurrence.
  const startDateValid = !isNaN(occurrence.startDate.getTime());
  const endDateValid = !isNaN(occurrence.endDate.getTime());

  return (
  <div className={cn("flex gap-2 items-center mb-2 w-full", disabled && "opacity-60 pointer-events-none", className)}>
    <div className="flex items-center gap-2 flex-1">
      <Input
        type="date"
        value={
          startDateValid
            ? formatLocalDatetime(occurrence.startDate).split('T')[0]
            : ""
        }
        onChange={(e) => {
          if (disabled) return;
          const currentTime = startDateValid
            ? formatLocalDatetime(occurrence.startDate).split('T')[1]
            : '00:00';
          updateOccurrence(index, "startDate", `${e.target.value}T${currentTime}`);
        }}
        className={cn("flex-1", disabled && "cursor-not-allowed bg-gray-100")}
        disabled={disabled}
      />
      <TimeIntervalPicker
        value={formatLocalDatetime(occurrence.startDate)}
        onChange={(value) => {
          if (disabled) return;
          updateOccurrence(index, "startDate", value);
        }}
        className="flex-1"
        date={
          startDateValid
            ? formatLocalDatetime(occurrence.startDate).split('T')[0]
            : undefined
        }
        disabled={disabled}
      />
    </div>
    <div className="flex items-center gap-2 flex-1">
      <Input
        type="date"
        value={
          endDateValid
            ? formatLocalDatetime(occurrence.endDate).split('T')[0]
            : ""
        }
        onChange={(e) => {
          if (disabled) return;
          const currentTime = endDateValid
            ? formatLocalDatetime(occurrence.endDate).split('T')[1]
            : '00:00';
          updateOccurrence(index, "endDate", `${e.target.value}T${currentTime}`);
        }}
        className={cn("flex-1", disabled && "cursor-not-allowed bg-gray-100")}
        disabled={disabled}
      />
      <TimeIntervalPicker
        value={formatLocalDatetime(occurrence.endDate)}
        onChange={(value) => {
          if (disabled) return;
          updateOccurrence(index, "endDate", value);
        }}
        className="flex-1"
        date={
          endDateValid
            ? formatLocalDatetime(occurrence.endDate).split('T')[0]
            : undefined
        }
        disabled={disabled}
      />
    </div>
  </div>
);
};

export default OccurrenceRow;