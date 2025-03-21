import React, { useState } from "react";

const times = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
});

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Slot {
  isBooked: boolean;
  isAvailable: boolean;
}

interface SlotsByDay {
  [day: string]: {
    [time: string]: Slot;
  };
}

interface EquipmentBookingGridProps {
  slotsByDay: SlotsByDay;
  onSelectSlots: (selectedSlots: string[]) => void;
}

export default function EquipmentBookingGrid({
  slotsByDay,
  onSelectSlots,
}: EquipmentBookingGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const toggleSlot = (day: string, time: string) => {
    const slot = slotsByDay?.[day]?.[time];

    if (!slot?.isAvailable || slot?.isBooked) return;

    const now = new Date();
    const dayIndex = days.indexOf(day);
    const todayIndex = now.getDay();
    const daysToAdd = (dayIndex + 7 - todayIndex) % 7;

    const [hour, minute] = time.split(":").map(Number);
    const startTime = new Date(now);
    startTime.setDate(now.getDate() + daysToAdd);
    startTime.setHours(hour, minute, 0, 0);

    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    const slotString = `${startTime.toISOString()}|${endTime.toISOString()}`;

    const updatedSlots = selectedSlots.includes(slotString)
      ? selectedSlots.filter((s) => s !== slotString)
      : [...selectedSlots, slotString];

    setSelectedSlots(updatedSlots);
    onSelectSlots(updatedSlots);
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-8 gap-1">
        <div></div> {/* Empty top-left cell */}
        {days.map((day) => (
          <div key={day} className="text-center font-bold">
            {day}
          </div>
        ))}

        {times.map((time) => (
          <React.Fragment key={time}>
            <div className="font-bold text-right pr-2">{time}</div>
            {days.map((day) => {
              const slot = slotsByDay?.[day]?.[time];

              const isSelected = selectedSlots.some((slotStr) => {
                const [start] = slotStr.split("|");
                const slotDate = new Date(start);
                const slotDay = slotDate.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const slotTime = slotDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
                return slotDay === day && slotTime === time;
              });

              return (
                <div
                  key={`${day}-${time}`}
                  className={`w-12 h-6 border cursor-pointer ${
                    slot?.isBooked || !slot?.isAvailable
                      ? "bg-red-300"
                      : isSelected
                      ? "bg-green-500"
                      : "bg-gray-100"
                  }`}
                  onClick={() => toggleSlot(day, time)}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
