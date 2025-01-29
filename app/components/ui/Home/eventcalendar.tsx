import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction"; // Enables event clicking

const EventCalendar: React.FC = () => {
  // Sample Static Events
  const sampleEvents = [
    { title: "MSYK Closed for Holiday", start: "2025-01-01", color: "#007bff" },
    { title: "Drop-In Session", start: "2025-01-05T11:00:00", color: "#ff9800" },
    { title: "Workshop - Textile Design", start: "2025-01-16T18:00:00", color: "#4caf50" },
    { title: "Knitting Class", start: "2025-01-22T19:00:00", color: "#e91e63" },
    { title: "Drop-In Session", start: "2025-01-26T11:00:00", color: "#9c27b0" },
  ];

  return (
    <section className="py-16 bg-gray-700 text-white">
      <div className="container mx-auto px-4 text-center">
        {/* Title */}
        <h2 className="text-4xl font-bold text-orange-500 mb-8">Event Calendar</h2>

        {/* Calendar Wrapper */}
        <div className="bg-white rounded-lg p-6 shadow-lg overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={sampleEvents} // Static events for now
            height="600px"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            eventDisplay="block"
            eventTextColor="white"
            eventBorderColor="transparent"
            dayMaxEventRows={3}
          />
        </div>

        {/* Mobile Alternative */}
        <p className="mt-6 text-lg text-orange-400">Using mobile? Try the link below:</p>
        <a
          href="#"
          className="bg-yellow-400 text-black px-6 py-3 mt-4 rounded-lg inline-block font-semibold hover:bg-yellow-500"
        >
          See the Calendar
        </a>
      </div>
    </section>
  );
};

export default EventCalendar;
