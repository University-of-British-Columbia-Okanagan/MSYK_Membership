import React from "react";
import { Paintbrush } from "lucide-react"; // Using Lucide React for the icon

const MakerMarketInfo = () => {
  return (
    <section className="bg-yellow-500 text-white py-16 px-6 relative">
      {/* Decorative thread element */}
      <div className="absolute left-0 bottom-0 w-48 md:w-64">
        <img
          src="/path-to-thread-graphic.png" // Replace with actual image path
          alt="Thread Graphic"
          className="w-full"
        />
      </div>

      <div className="container mx-auto text-center max-w-3xl relative z-10">
        {/* Icon */}
        <div className="flex justify-center">
          <Paintbrush size={50} className="text-white mb-4" />
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold">What is it?</h2>

        {/* Description */}
        <p className="text-lg mt-4">
          Makerspace YK's Maker Market is a three-day craft market held at
          Makerspace YK. It is designed to be a dynamic and inclusive platform,
          supporting artists, artisans, and creators across various fields,
          including visual arts, woodworking, electronics, Indigenous crafts,
          and DIY projects.
        </p>

        <p className="text-lg mt-4">
          In addition to the vendors, there will be family-friendly activities
          and workshops running throughout the duration of the market.
        </p>
      </div>
    </section>
  );
};

export default MakerMarketInfo;
