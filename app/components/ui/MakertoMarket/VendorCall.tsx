import React from "react";

const VendorCall = () => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 bg-yellow-500">
      {/* Left Section - Vendor Call */}
      <div className="bg-indigo-600 text-white py-16 px-8 relative">
        {/* Scissors Graphic */}
        <div className="absolute right-10 top-10">
          <img
            src="/path-to-scissors-graphic.png" // Replace with actual image path
            alt="Scissors"
            className="w-20"
          />
        </div>

        <h2 className="text-3xl font-bold">Vendor Call</h2>
        <p className="mt-4 text-lg">
          If you're a vendor or maker looking to showcase your products or
          services, apply today to become a vendor at our Maker Market!!
        </p>

        <p className="mt-4 text-md">
          <strong>Apply for a full table, half table, or at our shared community table!</strong>
        </p>

        <ul className="mt-2 text-md">
          <li><strong>Full Table:</strong> 6 x 3 feet ($50 per day)</li>
          <li><strong>Half Table:</strong> 3 x 3 feet ($20 per day)</li>
          <li><strong>Community Table:</strong> No vending fee! MSYK takes a 10% commission.</li>
        </ul>

        <p className="mt-4 italic text-lg">Applications Closed</p>
      </div>

      {/* Right Section - Maker Market Details */}
      <div className="bg-orange-500 text-white py-16 px-8">
        <h2 className="text-3xl font-bold">Maker Market 2024</h2>
        <p className="mt-4 text-lg">November 15-17, 2024</p>

        <ul className="mt-2 text-md">
          <li><strong>Friday, Nov. 15th:</strong> 3-8pm</li>
          <li><strong>Saturday, Nov. 16th:</strong> 12-5pm</li>
          <li><strong>Sunday, Nov. 17th:</strong> 12-5pm</li>
        </ul>

        <p className="mt-4 text-md"><strong>Location:</strong> Makerspace YK</p>
        <p className="mt-4 italic text-lg">Activities coming soon!</p>
      </div>
    </section>
  );
};

export default VendorCall;
