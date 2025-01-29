import React from "react";

const RentalRates = () => {
  return (
    <section className="py-16 text-center bg-white">
      {/* Title */}
      <h2 className="text-3xl font-bold text-gray-800">
        Rental Rates & Information
      </h2>
      <div className="w-16 h-1 bg-gray-400 mx-auto mt-2"></div>

      {/* Description */}
      <p className="text-lg text-gray-600 max-w-2xl mx-auto mt-4">
        MSYK has tiered booking rates so that renting can be more accessible for different users.
        Larger non-profit and for-profit rates are higher to help support grassroots organizations 
        and community members that would like to host events!
      </p>

      {/* Buttons */}
      <div className="mt-6 space-y-4 flex flex-col items-center">
        <a
          href="/path-to-rental-rates.pdf" // Replace with actual rental rates file or link
          target="_blank"
          rel="noopener noreferrer"
          className="bg-orange-500 text-white px-6 py-3 rounded-full text-lg font-semibold hover:bg-orange-600 transition flex items-center gap-2"
        >
          <span>📄</span> 2023 Artspace Rental Rates
        </a>

        <a
          href="https://docs.google.com/forms/d/e/your-google-form-id/viewform" // Replace with actual Google Form link
          target="_blank"
          rel="noopener noreferrer"
          className="bg-orange-500 text-white px-6 py-3 rounded-full text-lg font-semibold hover:bg-orange-600 transition"
        >
          Artspace Rental Form
        </a>
      </div>

      {/* CTA for Form */}
      <p className="text-lg font-semibold text-orange-500 mt-6">
        Fill out the form below to make a rental request!
      </p>

      <div className="mt-4 animate-bounce text-orange-500 text-2xl">⬇</div>

      {/* Embedded Google Form */}
      <div className="mt-8 max-w-4xl mx-auto">
        <iframe
          src="https://docs.google.com/forms/d/e/your-google-form-id/viewform?embedded=true"
          width="100%"
          height="800"
          className="border border-gray-300 rounded-lg"
        >
          Loading…
        </iframe>
      </div>
    </section>
  );
};

export default RentalRates;
