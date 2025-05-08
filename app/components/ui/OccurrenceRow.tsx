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
  className?: string; // Add this to accept custom styling
}

const OccurrenceRow: React.FC<OccurrenceRowProps> = ({
  index,
  occurrence,
  updateOccurrence,
  formatLocalDatetime,
  className, // Accept className prop
}) => {
  // Determine if a valid date has been selected for each occurrence.
  const startDateValid = !isNaN(occurrence.startDate.getTime());
  const endDateValid = !isNaN(occurrence.endDate.getTime());

  return (
    <div className={cn("flex gap-2 items-center mb-2 w-full", className)}>
      <div className="flex items-center gap-2 flex-1">
        <Input
          type="date"
          value={
            startDateValid
              ? formatLocalDatetime(occurrence.startDate).split('T')[0]
              : ""
          }
          onChange={(e) => {
            const currentTime = startDateValid
              ? formatLocalDatetime(occurrence.startDate).split('T')[1]
              : '00:00';
            updateOccurrence(index, "startDate", `${e.target.value}T${currentTime}`);
          }}
          className="flex-1"
        />
        <TimeIntervalPicker
          value={formatLocalDatetime(occurrence.startDate)}
          onChange={(value) => updateOccurrence(index, "startDate", value)}
          className="flex-1"
          date={
            startDateValid
              ? formatLocalDatetime(occurrence.startDate).split('T')[0]
              : undefined
          }
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
            const currentTime = endDateValid
              ? formatLocalDatetime(occurrence.endDate).split('T')[1]
              : '00:00';
            updateOccurrence(index, "endDate", `${e.target.value}T${currentTime}`);
          }}
          className="flex-1"
        />
        <TimeIntervalPicker
          value={formatLocalDatetime(occurrence.endDate)}
          onChange={(value) => updateOccurrence(index, "endDate", value)}
          className="flex-1"
          date={
            endDateValid
              ? formatLocalDatetime(occurrence.endDate).split('T')[0]
              : undefined
          }
        />
      </div>
    </div>
  );
};

export default OccurrenceRow;