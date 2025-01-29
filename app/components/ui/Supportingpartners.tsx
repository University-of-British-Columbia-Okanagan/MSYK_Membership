import React from "react";

const SupportingPartners = () => {
  return (
    <section className="py-12 bg-gray-100">
      {/* Colored Divider */}
      <div className="w-full h-2 bg-gradient-to-r from-yellow-400 via-indigo-500 to-orange-500 mb-6" />

      <div className="container mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Supporting Partners</h2>

        {/* Partner Logos Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-center">
          <img src="/partners/northwest-territories.png" alt="Government of Northwest Territories" className="max-h-24 mx-auto" />
          <img src="/partners/canada.png" alt="Government of Canada" className="max-h-24 mx-auto" />
          <img src="/partners/city-yellowknife.png" alt="City of Yellowknife" className="max-h-24 mx-auto" />
          <img src="/partners/tamarack-institute.png" alt="Tamarack Institute" className="max-h-24 mx-auto" />
          <img src="/partners/yellowknife-chamber.png" alt="Yellowknife Chamber" className="max-h-24 mx-auto" />
          <img src="/partners/arctic-prize.png" alt="Arctic Inspiration Prize" className="max-h-24 mx-auto" />
          <img src="/partners/economic-agency.png" alt="Northern Economic Agency" className="max-h-24 mx-auto" />
        </div>
      </div>
    </section>
  );
};

export default SupportingPartners;
