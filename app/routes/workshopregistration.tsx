import React from "react";
import HeroSection from "@/components/ui/HeroSection"; // Common Hero Component
import Footer from "@/components/ui/Home/Footer"; 

const workshops = [
  {
    title: "Craft Your Own Charcuterie/Serving Board",
    price: "$120",
    duration: "Ended",
    image: "https://via.placeholder.com/300",
    link: "#",
  },
  {
    title: "Rug Tufting Workshop",
    price: "$225",
    duration: "Ended",
    image: "https://via.placeholder.com/300",
    link: "#",
  },
  {
    title: "Sublimation Mug Workshop",
    price: "$45",
    duration: "3 hr",
    image: "https://via.placeholder.com/300",
    link: "#",
  },
];

const WorkshopRegistration = () => {
  return (
    <main className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <HeroSection title="Workshop Registration" />

      {/* Workshop Categories */}
      <section className="text-center py-8">
        <h2 className="text-2xl font-semibold text-gray-800">MSYK Workshops</h2>
        <div className="mt-4 flex justify-center space-x-4 text-gray-600 text-sm">
          <button className="border-b-2 border-orange-500 pb-1 font-medium">
            Workshops
          </button>
          <button className="hover:text-orange-500">Orientations</button>
          <button className="hover:text-orange-500">Free & Drop-In Events</button>
          <button className="hover:text-orange-500">Courses</button>
          <button className="hover:text-orange-500">Maker to Market</button>
        </div>
      </section>

      {/* Workshop Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        {workshops.map((workshop, index) => (
          <div
            key={index}
            className="border rounded-lg shadow-sm p-4 flex flex-col items-center"
          >
            <img
              src={workshop.image}
              alt={workshop.title}
              className="w-full h-48 object-cover rounded-md"
            />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 text-center">
              {workshop.title}
            </h3>
            <a href={workshop.link} className="text-orange-500 font-medium mt-1">
              Read More
            </a>
            <p className="text-gray-500 mt-1">{workshop.duration}</p>
            <p className="text-lg font-bold text-gray-800">{workshop.price}</p>
            <a
              href={workshop.link}
              className="mt-4 px-4 py-2 bg-yellow-500 text-white font-semibold rounded-md hover:bg-yellow-600 transition"
            >
              {workshop.duration === "Ended" ? "View Course" : "Book Now"}
            </a>
          </div>
        ))}
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
};

export default WorkshopRegistration;
