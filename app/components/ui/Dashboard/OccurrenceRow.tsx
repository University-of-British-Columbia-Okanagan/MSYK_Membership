import React from "react";
import { Input } from "@/components/ui/input";
import { TimeIntervalPicker } from "./TimeIntervalPicker";
import { cn } from "@/lib/utils"; // Make sure to import cn
import { isEndBeforeStart } from "~/utils/occurrences";

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

  // The end fields stay locked until a start exists — start and end are set
  // independently now, so an end without a start has nothing to be measured against.
  const endDisabled = disabled || !startDateValid;
  const endBeforeStart = isEndBeforeStart(occurrence);

  const startDay = startDateValid
    ? formatLocalDatetime(occurrence.startDate).split("T")[0]
    : undefined;
  const endDay = endDateValid
    ? formatLocalDatetime(occurrence.endDate).split("T")[0]
    : undefined;

  return (
    <div className={cn("flex flex-col mb-2 w-full", className)}>
      <div
        className={cn(
          "flex flex-col sm:flex-row gap-2 sm:items-center w-full",
          disabled && "opacity-60 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="date"
            value={startDay ?? ""}
            onChange={(e) => {
              if (disabled) return;
              const currentTime = startDateValid
                ? formatLocalDatetime(occurrence.startDate).split("T")[1]
                : "00:00";
              updateOccurrence(
                index,
                "startDate",
                `${e.target.value}T${currentTime}`
              );
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
            date={startDay}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="date"
            value={endDay ?? ""}
            onChange={(e) => {
              if (endDisabled) return;
              const currentTime = endDateValid
                ? formatLocalDatetime(occurrence.endDate).split("T")[1]
                : "00:00";
              updateOccurrence(
                index,
                "endDate",
                `${e.target.value}T${currentTime}`
              );
            }}
            className={cn(
              "flex-1",
              endDisabled && "cursor-not-allowed bg-gray-100",
              endBeforeStart && "border-red-500 focus-visible:ring-red-500"
            )}
            disabled={endDisabled}
          />
          <TimeIntervalPicker
            value={formatLocalDatetime(occurrence.endDate)}
            onChange={(value) => {
              if (endDisabled) return;
              updateOccurrence(index, "endDate", value);
            }}
            className={cn(
              "flex-1",
              endBeforeStart && "border-red-500 focus:ring-red-500"
            )}
            // Falls back to the start's day so the picker unlocks as soon as a
            // start exists, rather than waiting on an end date first. With no
            // start either, the undefined date disables it with the right
            // "select a date" hint rather than the registered-users wording.
            date={endDay ?? startDay}
            disabled={disabled}
          />
        </div>
      </div>
      {endBeforeStart && (
        <p className="text-sm text-red-600 font-medium mt-1">
          This session ends before it starts. Set an end after{" "}
          {formatLocalDatetime(occurrence.startDate).replace("T", " ")}.
        </p>
      )}
    </div>
  );
};

export default OccurrenceRow;
