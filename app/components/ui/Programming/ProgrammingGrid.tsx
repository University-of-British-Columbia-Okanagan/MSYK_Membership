import React from "react";

const ProgrammingGrid = () => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2">
      {/* Left Column */}
      <div
        className="bg-cover bg-center h-80"
        style={{
          backgroundImage: "url('public/images/programming img1.avif')", // Change to programming image
        }}
      />
      <div className="bg-indigo-500 text-white flex flex-col justify-center items-center p-12">
        <h2 className="text-3xl font-bold mb-4">
          Register for a workshop and learn a new skill!
        </h2>
        <button className="bg-gray-800 text-white px-6 py-3 mt-4 rounded-lg font-semibold hover:bg-gray-900 transition">
          Register →
        </button>
      </div>

      {/* Bottom Row */}
      <div className="bg-gray-800 text-white flex flex-col justify-center items-center p-12">
        <h2 className="text-3xl font-bold mb-4">
          See our event and workshop calendar!
        </h2>
        <button className="bg-yellow-500 text-white px-6 py-3 mt-4 rounded-lg font-semibold hover:bg-yellow-600 transition">
          What's On →
        </button>
      </div>
      <div
        className="bg-cover bg-center h-80"
        style={{
          backgroundImage: "url('public/images/Programming img2.avif')", // Change to programming image
        }}
      />
    </section>
  );
};

export default ProgrammingGrid;
