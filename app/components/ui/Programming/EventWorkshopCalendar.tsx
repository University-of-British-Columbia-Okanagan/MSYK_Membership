import React from "react";

const EventWorkshopCalendar = () => {
  return (
    <div className="bg-gray-800 text-white p-12 flex flex-col justify-center items-center">
      <h2 className="text-3xl font-bold mb-4">See our event and workshop calendar!</h2>
      <button className="bg-yellow-500 text-black px-6 py-3 mt-4 rounded-lg font-semibold hover:bg-yellow-600 transition">
        What's on →
      </button>
    </div>
  );
};

export default EventWorkshopCalendar;
