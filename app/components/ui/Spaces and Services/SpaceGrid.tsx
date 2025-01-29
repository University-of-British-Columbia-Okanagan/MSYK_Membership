import React from "react";

const SpacesGrid = () => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2">
      {/* Left Column */}
      <div className="bg-cover bg-center h-80" style={{ backgroundImage: "url('https://via.placeholder.com/800x600')" }} />
      <div className="bg-yellow-500 text-white flex flex-col justify-center items-center p-12">
        <h2 className="text-3xl font-bold mb-4">View our inventory of equipment!</h2>
        <button className="bg-gray-800 text-white px-6 py-3 mt-4 rounded-lg font-semibold hover:bg-gray-900 transition">
          More Info
        </button>
      </div>

      {/* Bottom Row */}
      <div className="bg-orange-500 text-white flex flex-col justify-center items-center p-12">
        <h2 className="text-3xl font-bold mb-4">Interested in holding an event at Makerspace YK?</h2>
        <button className="bg-gray-800 text-white px-6 py-3 mt-4 rounded-lg font-semibold hover:bg-gray-900 transition">
          More Info
        </button>
      </div>
      <div className="bg-cover bg-center h-80" style={{ backgroundImage: "url('https://via.placeholder.com/800x600')" }} />
    </section>
  );
};

export default SpacesGrid;
