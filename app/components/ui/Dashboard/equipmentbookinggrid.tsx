"use client"

import React, { useState, useRef } from "react"

// Time slots in 30-minute increments
const times = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minutes = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minutes}`
})

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface Slot {
  id: number | null
  isBooked: boolean
  isAvailable: boolean
  workshopName?: string | null
}

interface SlotsByDay {
  [day: string]: {
    [time: string]: Slot
  }
}

interface EquipmentBookingGridProps {
  slotsByDay: SlotsByDay
  onSelectSlots: (selectedSlots: string[]) => void
}

export default function EquipmentBookingGrid({ slotsByDay, onSelectSlots }: EquipmentBookingGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const isDragging = useRef(false)

  const handleSlotToggle = (day: string, time: string) => {
    const slot = slotsByDay?.[day]?.[time]
    if (!slot?.isAvailable || slot?.isBooked) return
  
    const now = new Date()
    const dayIndex = days.indexOf(day)
    const todayIndex = now.getDay()
    const daysToAdd = (dayIndex + 7 - todayIndex) % 7
  
    const [hour, minute] = time.split(":").map(Number)
    const startTime = new Date(now)
    startTime.setDate(now.getDate() + daysToAdd)
    startTime.setHours(hour, minute, 0, 0)
  
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000)
    const slotString = `${startTime.toISOString()}|${endTime.toISOString()}`
  
    const isAlreadySelected = selectedSlots.includes(slotString)
  
    // Count current day and total week slot selections
    const slotsPerDay: { [day: string]: number } = {}
    let totalSlots = 0
  
    for (const s of selectedSlots) {
      const [start] = s.split("|")
      const d = new Date(start).toLocaleDateString("en-US", { weekday: "short" })
      slotsPerDay[d] = (slotsPerDay[d] || 0) + 1
      totalSlots += 1
    }
  
    const currentDayCount = slotsPerDay[day] || 0
    const newDayCount = isAlreadySelected ? currentDayCount - 1 : currentDayCount + 1
    const newWeekCount = isAlreadySelected ? totalSlots - 1 : totalSlots + 1
  
    if (!isAlreadySelected && newDayCount > 4) {
      alert("Limit reached: You can only select up to 2 hours (4 slots) per day.")
      return
    }
  
    if (!isAlreadySelected && newWeekCount > 28) {
      alert("Limit reached: You can only select up to 14 hours (28 slots) per week.")
      return
    }
  
    const updatedSlots = isAlreadySelected
      ? selectedSlots.filter((s) => s !== slotString)
      : [...selectedSlots, slotString]
  
    setSelectedSlots(updatedSlots)
    onSelectSlots(updatedSlots)
  }
  

  const currentDayIndex = new Date().getDay()

  return (
    <div className="w-full max-w-screen-xl mx-auto">
      {/* Legend */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center gap-4 justify-center mb-2 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-pink-100 border border-gray-300" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 border border-gray-300" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-white border border-gray-300" />
            <span>Unselected</span>
          </div>
        </div>
        <p className="text-md font-medium">Click and Drag to Toggle</p>
      </div>

      {/* Grid */}
      <div
        className="grid border border-gray-300 rounded text-xs"
        style={{
          gridTemplateColumns: "80px repeat(7, 120px)",
        }}
        onMouseDown={() => (isDragging.current = true)}
        onMouseUp={() => (isDragging.current = false)}
        onMouseLeave={() => (isDragging.current = false)}
      >
        {/* Empty top-left cell */}
        <div className="bg-white border-b border-r border-gray-300"></div>

        {/* Day headers */}
        {days.map((day, index) => {
          const isToday = index === currentDayIndex
          return (
            <div
              key={day}
              className={`text-center py-2 border-b border-r border-gray-300 ${
                isToday ? "bg-yellow-100 font-bold" : "bg-white"
              }`}
            >
              <div className="text-sm">{day}</div>
            </div>
          )
        })}

        {/* Time rows */}
        {times.map((time) => {
          const showTime = time.endsWith("00")
          const [hour] = time.split(":")
          const displayHour = Number(hour)
          const formattedTime = showTime
            ? displayHour === 0
              ? "12:00 AM"
              : displayHour === 12
              ? "12:00 PM"
              : `${displayHour % 12}:00 ${displayHour < 12 ? "AM" : "PM"}`
            : ""

          return (
            <React.Fragment key={time}>
              {/* Time label column */}
              <div
                className={`text-right pr-2 py-1 border-b border-r border-gray-300 bg-white ${
                  showTime ? "font-medium" : ""
                }`}
              >
                {formattedTime}
              </div>

              {/* Slot cells */}
              {days.map((day) => {
                const slot = slotsByDay?.[day]?.[time] ?? { isAvailable: false, isBooked: false }

                const isSelected = selectedSlots.some((slotStr) => {
                  const [start] = slotStr.split("|")
                  const slotDate = new Date(start)
                  const slotDay = slotDate.toLocaleDateString("en-US", { weekday: "short" })
                  const slotTime = slotDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                  return slotDay === day && slotTime === time
                })

                const baseStyle = "w-full h-6 border-b border-r border-gray-300 transition-all duration-100"
                const colorClass = slot?.isBooked
                  ? "bg-red-400 cursor-not-allowed"
                  : isSelected
                  ? "bg-green-500"
                  : slot?.isAvailable
                  ? "bg-white hover:bg-green-200 cursor-pointer"
                  : "bg-pink-100 cursor-not-allowed"

                return (
                  <div
                    key={`${day}-${time}`}
                    className={`${baseStyle} ${colorClass}`}
                    onClick={() => handleSlotToggle(day, time)}
                    onMouseEnter={() => isDragging.current && handleSlotToggle(day, time)}
                  />
                )
              })}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
