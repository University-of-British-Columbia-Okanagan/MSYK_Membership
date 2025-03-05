import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeIntervalPickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const generateTimeIntervals = () => {
  const intervals: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 15, 30, 45]) {
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMinute = minute.toString().padStart(2, '0');
      intervals.push(`${formattedHour}:${formattedMinute}`);
    }
  }
  return intervals;
};

export const TimeIntervalPicker: React.FC<TimeIntervalPickerProps> = ({
  value,
  onChange,
  className,
  disabled = false,
}) => {
  const timeIntervals = generateTimeIntervals();
  
  // Safely extract time from the input value
  const extractTime = (inputValue: string | undefined): string => {
    if (!inputValue) return '';
    
    // Handle different input formats
    try {
      // Try parsing as a full datetime
      const date = new Date(inputValue);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
      
      // Handle direct time string
      if (inputValue.includes(':')) {
        const [hours, minutes] = inputValue.split(':');
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      }
    } catch (error) {
      console.error('Error extracting time:', error);
    }
    
    return '';
  };

  const [selectedTime, setSelectedTime] = useState(extractTime(value));

  // Update state when value prop changes
  useEffect(() => {
    setSelectedTime(extractTime(value));
  }, [value]);

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    
    // If a date input exists (for datetime-local), preserve the date
    if (value && value.includes('T')) {
      const [datePart] = value.split('T');
      onChange(`${datePart}T${newTime}`);
    } else {
      onChange(newTime);
    }
  };

  return (
    <Select 
      value={selectedTime} 
      onValueChange={handleTimeChange}
      disabled={disabled}
    >
      <SelectTrigger className={`w-full ${className}`} disabled={disabled}>
        <SelectValue placeholder={disabled ? "Select date first" : "Select time"}>
          {selectedTime}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        {timeIntervals.map((time) => (
          <SelectItem key={time} value={time}>
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};