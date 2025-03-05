import React from "react";
import { Input } from "@/components/ui/input";
import { TimeIntervalPicker } from "./TimeIntervalPicker"; // Import the new component

export interface Occurrence {
  startDate: Date;
  endDate: Date;
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
  // Determine if a valid date has been selected for each occurrence.
  const startDateValid = !isNaN(occurrence.startDate.getTime());
  const endDateValid = !isNaN(occurrence.endDate.getTime());

  return (
    <div className="flex gap-2 items-center mb-2 w-full">
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
          disabled={!startDateValid}
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
          disabled={!endDateValid}
        />
      </div>
    </div>
  );
};

export default OccurrenceRow;
