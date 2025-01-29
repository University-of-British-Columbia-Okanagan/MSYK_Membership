import React from "react";

const EventCalendar: React.FC = () => {
  return (
    <section className="py-16 bg-gray-700 text-white">
      <div className="container mx-auto px-4 text-center">
        {/* Title */}
        <h2 className="text-4xl font-bold text-orange-500 mb-8">Event Calendar</h2>

        {/* Google Calendar Embed */}
        <div className="flex justify-center">
          <iframe
            src="https://calendar.google.com/calendar/embed?src=your_calendar_id&ctz=America%2FEdmonton"
            className="w-full md:w-3/4 h-[600px] border-2 rounded-lg shadow-lg"
            style={{ border: 0 }}
            frameBorder="0"
            scrolling="no"
          ></iframe>
        </div>

        {/* Mobile Alternative Link */}
        <p className="mt-6 text-lg text-orange-400">Using mobile? Try the link below:</p>
        <a
          href="https://calendar.google.com/calendar/u/0?cid=your_calendar_id"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-yellow-400 text-black px-6 py-3 mt-4 rounded-lg inline-block font-semibold hover:bg-yellow-500"
        >
          See the Calendar
        </a>
      </div>
    </section>
  );
};

export default EventCalendar;
