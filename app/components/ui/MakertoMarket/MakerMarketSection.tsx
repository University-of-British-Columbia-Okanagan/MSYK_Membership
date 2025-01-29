import React from "react";

const MakerMarketSection: React.FC = () => {
  return (
    <section className="bg-orange-500 text-white py-12 text-center relative">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold">Participate in our Maker Market!</h2>
        <p className="mt-4 max-w-2xl mx-auto">
          If you're a vendor or maker looking to showcase your products or services, apply today to become a vendor at our Maker Market!
        </p>
        <button className="mt-6 px-6 py-2 bg-yellow-400 text-black font-semibold rounded-md">
          More Info
        </button>
      </div>
    </section>
  );
};

export default MakerMarketSection;
