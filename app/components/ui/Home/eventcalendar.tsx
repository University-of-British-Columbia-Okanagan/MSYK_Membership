import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction"; 
import googleCalendarPlugin from "@fullcalendar/google-calendar"; // Import Google Calendar Plugin

const EventCalendar: React.FC = () => {
  return (
    <section className="py-12 bg-gray-600">
      <div className="container mx-auto px-4 text-center">
        {/* Title */}
        <h2 className="text-4xl font-bold text-white mb-6">What's Happening</h2>

        {/* Calendar Wrapper */}
        <div className="bg-white rounded-lg p-6 shadow-lg overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, googleCalendarPlugin]}
            initialView="dayGridMonth"
            googleCalendarApiKey="YOUR_GOOGLE_CALENDAR_API_KEY" //TODO: Ask Aileen for google calendar API key
            events={{
              googleCalendarId: "your_calendar_id@group.calendar.google.com",
            }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            eventColor="#1a73e8" // Default Google Blue
            height="auto"
            dayMaxEventRows={3}
            nowIndicator={true}
            eventDisplay="block"
            eventTextColor="white"
            eventBorderColor="transparent"
          />
        </div>
      </div>
    </section>
  );
};

export default EventCalendar;
