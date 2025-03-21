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

export default function EquipmentBookingGrid({ slotsByDay, onSelectSlots }: EquipmentBookingGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const toggleSlot = (day: string, time: string) => {
    const key = `${day}-${time}`;
    const isBooked = slotsByDay?.[day]?.[time]?.isBooked;
    
    if (!isBooked) {
      setSelectedSlots((prev) =>
        prev.includes(key) ? prev.filter((slot) => slot !== key) : [...prev, key]
      );
      onSelectSlots(selectedSlots);
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-8 gap-1">
        <div></div> {/* Empty Top Left Corner */}
        {days.map((day) => (
          <div key={day} className="text-center font-bold">{day}</div>
        ))}

        {times.map((time) => (
          <>
            <div key={time} className="font-bold text-right pr-2">{time}</div>
            {days.map((day) => {
              const key = `${day}-${time}`;
              const slot = slotsByDay?.[day]?.[time];
              return (
                <div
                  key={key}
                  className={`w-12 h-6 border cursor-pointer ${
                    slot?.isBooked || !slot?.isAvailable ? "bg-red-300" :
                    selectedSlots.includes(key) ? "bg-green-500" : "bg-gray-100"
                  }`}
                  onClick={() => toggleSlot(day, time)}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
