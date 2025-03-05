import React from "react";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  const handleAppendDates = () => {
    if (!startDate || !endDate) {
      alert("Please select initial start and end dates");
      return;
    }
    if (interval < 1 || count < 1) {
      alert("Please enter valid interval and repetition numbers");
      return;
    }
    const newOccurrences: { startDate: Date; endDate: Date; status?: string; userCount?: number }[] = [];
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
      const existingStartDates = occurrences.map(o => o.startDate);
      if (!isDuplicateDate(occurrence.startDate, existingStartDates)) {
        const computedStatus = occurrence.startDate >= new Date() ? "active" : "past";
        newOccurrences.push({ ...occurrence, status: computedStatus, userCount: 0 });
      }
    }
    const updatedOccurrences = [...occurrences, ...newOccurrences];
    updatedOccurrences.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    setOccurrences(updatedOccurrences);
    updateFormOccurrences(updatedOccurrences);
    // After appending, revert back to custom view.
    onRevert();
  };

  return (
    <div className="flex flex-col items-start w-full space-y-4">
      {/* First Occurrence Inputs */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="flex flex-col space-y-2">
          <FormLabel>First Occurrence Start</FormLabel>
          <Input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col space-y-2">
          <FormLabel>First Occurrence End</FormLabel>
          <Input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
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
        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md shadow transition text-sm"
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