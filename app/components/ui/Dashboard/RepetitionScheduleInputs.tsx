import React from "react";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TimeIntervalPicker } from "./TimeIntervalPicker";
import { cn } from "@/lib/utils";
import {
  isEndBeforeStart,
  sortOccurrencesByStart,
} from "~/utils/occurrences";

export interface Occurrence {
  startDate: Date;
  endDate: Date;
  status?: string;
  userCount?: number;
}

export interface RepetitionScheduleInputsProps {
  scheduleType: "weekly" | "monthly" | string;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  interval: number;
  setInterval: (val: number) => void;
  count: number;
  setCount: (val: number) => void;
  occurrences: Occurrence[];
  setOccurrences: (occ: Occurrence[]) => void;
  updateFormOccurrences: (occ: Occurrence[]) => void;
  parseDateTimeAsLocal: (val: string) => Date;
  isDuplicateDate: (newDate: Date, existingDates: Date[]) => boolean;
  onRevert: () => void;
}

const RepetitionScheduleInputs: React.FC<RepetitionScheduleInputsProps> = ({
  scheduleType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  interval,
  setInterval,
  count,
  setCount,
  occurrences,
  setOccurrences,
  updateFormOccurrences,
  parseDateTimeAsLocal,
  isDuplicateDate,
  onRevert,
}) => {
  // Determine labels based on scheduleType.
  const repeatLabel =
    scheduleType === "weekly"
      ? "Repeat every (weeks)"
      : scheduleType === "monthly"
        ? "Repeat every (months)"
        : "Repeat every";
  const placeholderInterval =
    scheduleType === "weekly"
      ? "Week interval"
      : scheduleType === "monthly"
        ? "Month interval"
        : "Interval";

  // Helper function to update date with time
  const updateDateTime = (
    currentDate: string,
    field: "startDate" | "endDate",
    newTime: string
  ) => {
    const [datePart] = currentDate.split("T");
    const newDateTime = `${datePart}T${newTime}`;

    if (field === "startDate") {
      setStartDate(newDateTime);
    } else {
      setEndDate(newDateTime);
    }
  };

  const handleAppendDates = () => {
    if (!startDate || !endDate) {
      alert("Please select initial start and end dates");
      return;
    }
    if (
      isEndBeforeStart({
        startDate: parseDateTimeAsLocal(startDate),
        endDate: parseDateTimeAsLocal(endDate),
      })
    ) {
      alert("The end date and time must be after the start");
      return;
    }
    if (interval < 1 || count < 1) {
      alert("Please enter valid interval and repetition numbers");
      return;
    }
    const newOccurrences: {
      startDate: Date;
      endDate: Date;
      status?: string;
      userCount?: number;
    }[] = [];
    const start = parseDateTimeAsLocal(startDate);
    const end = parseDateTimeAsLocal(endDate);
    const baseOccurrence = {
      startDate: new Date(start),
      endDate: new Date(end),
    };

    for (let i = 0; i < count; i++) {
      const occurrence = {
        startDate: new Date(baseOccurrence.startDate),
        endDate: new Date(baseOccurrence.endDate),
      };
      if (scheduleType === "weekly") {
        occurrence.startDate.setDate(
          baseOccurrence.startDate.getDate() + interval * 7 * i
        );
        occurrence.endDate.setDate(
          baseOccurrence.endDate.getDate() + interval * 7 * i
        );
      } else if (scheduleType === "monthly") {
        occurrence.startDate.setMonth(
          baseOccurrence.startDate.getMonth() + interval * i
        );
        occurrence.endDate.setMonth(
          baseOccurrence.endDate.getMonth() + interval * i
        );
      } else {
        // Extend logic for other schedule types (e.g., yearly) here.
      }
      // Prevent duplicate dates.
      const existingStartDates = occurrences.map((o) => o.startDate);
      if (!isDuplicateDate(occurrence.startDate, existingStartDates)) {
        const computedStatus =
          occurrence.startDate >= new Date() ? "active" : "past";
        newOccurrences.push({
          ...occurrence,
          status: computedStatus,
          userCount: 0,
        });
      }
    }
    const updatedOccurrences = sortOccurrencesByStart([
      ...occurrences,
      ...newOccurrences,
    ]);
    setOccurrences(updatedOccurrences);
    updateFormOccurrences(updatedOccurrences);
    // After appending, revert back to custom view.
    onRevert();
  };

  // The end fields stay locked until a start exists, so an end can never be
  // entered against a start that is not there yet.
  const startIsSet = !!startDate && !isNaN(parseDateTimeAsLocal(startDate).getTime());
  const endBeforeStart =
    startIsSet &&
    !!endDate &&
    isEndBeforeStart({
      startDate: parseDateTimeAsLocal(startDate),
      endDate: parseDateTimeAsLocal(endDate),
    });

  return (
    <div className="flex flex-col items-start w-full space-y-4">
      {/* First Occurrence Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <div className="flex flex-col space-y-2">
          <FormLabel>First Occurrence Start</FormLabel>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate ? startDate.split("T")[0] : ""}
              onChange={(e) => {
                const currentTime = startDate
                  ? startDate.split("T")[1]
                  : "00:00";
                setStartDate(`${e.target.value}T${currentTime}`);
              }}
              className="flex-1"
            />
            <TimeIntervalPicker
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
              }}
              date={startDate ? startDate.split("T")[0] : undefined}
              className="flex-1"
            />
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          <FormLabel>First Occurrence End</FormLabel>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={endDate ? endDate.split("T")[0] : ""}
              onChange={(e) => {
                const currentTime = endDate ? endDate.split("T")[1] : "00:00";
                setEndDate(`${e.target.value}T${currentTime}`);
              }}
              disabled={!startIsSet}
              className={cn(
                "flex-1",
                !startIsSet && "cursor-not-allowed bg-gray-100",
                endBeforeStart && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            <TimeIntervalPicker
              value={endDate}
              onChange={(value) => setEndDate(value)}
              // Falls back to the start's day so the picker unlocks as soon as a
              // start exists, rather than waiting on an end date first. With no
              // start either, the undefined date is what disables it.
              date={
                endDate || startDate
                  ? (endDate || startDate).split("T")[0]
                  : undefined
              }
              className={cn(
                "flex-1",
                endBeforeStart && "border-red-500 focus:ring-red-500"
              )}
            />
          </div>
        </div>
      </div>
      {endBeforeStart && (
        <p className="text-sm text-red-600 font-medium">
          The end date and time is before the start. Pick an end that is after{" "}
          {startDate.replace("T", " ")}.
        </p>
      )}
      {/* Interval and Count Inputs */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="flex flex-col space-y-2">
          <FormLabel>{repeatLabel}</FormLabel>
          <Input
            type="number"
            min="1"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            placeholder={placeholderInterval}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <FormLabel>Number of repetitions</FormLabel>
          <Input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            placeholder="Total occurrences"
          />
        </div>
      </div>
      <Button
        type="button"
        onClick={handleAppendDates}
        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
      >
        {scheduleType === "weekly"
          ? "Append Weekly Dates"
          : scheduleType === "monthly"
            ? "Append Monthly Dates"
            : "Append Dates"}
      </Button>
    </div>
  );
};

export default RepetitionScheduleInputs;
