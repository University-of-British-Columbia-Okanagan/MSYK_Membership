import React from "react";

const MakerToMarketTraining = () => {
  return (
    <section className="bg-yellow-500 py-16 text-center relative">
      {/* Decorative Pencil Graphics */}
      <div className="absolute left-10 top-10">
        <img
          src="/path-to-pencil-graphic-left.png" // Replace with actual image path
          alt="Pencil Left"
          className="w-12"
        />
      </div>

      <div className="absolute right-10 top-10">
        <img
          src="/path-to-pencil-graphic-right.png" // Replace with actual image path
          alt="Pencil Right"
          className="w-12"
        />
      </div>

      {/* Section Title */}
      <h2 className="text-3xl font-bold text-gray-900">
        Join our Maker to Market training series!
      </h2>

      {/* Subtitle */}
      <p className="italic text-lg text-gray-800 mt-4">
        Start a side hustle or expand your small business using digital
        technologies!
      </p>

      {/* Description */}
      <p className="text-md text-gray-900 max-w-3xl mx-auto mt-4">
        This training program will introduce you to a number of digital
        techniques and manufacturing processes that will help kickstart a new
        side hustle or help you scale up production using digital fabrication
        for your small business!
      </p>

      {/* More Info Button */}
      <div className="mt-6">
        <a
          href="/maker-to-market"
          className="bg-orange-500 text-white px-6 py-3 rounded-full text-lg font-semibold hover:bg-orange-600 transition"
        >
          More Info
        </a>
      </div>
    </section>
  );
};

export default MakerToMarketTraining;
