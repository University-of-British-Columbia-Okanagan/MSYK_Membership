import React from "react";
import HeroSection from "@/components/ui/HeroSection"; // Common Hero Component
import Footer from "@/components/ui/Home/Footer";
import { Button } from "~/components/ui/button";

const workshops = [
  {
    title: "Craft Your Own Charcuterie/Serving Board",
    price: "$120",
    duration: "Ended",
    image: "public/images/workshopregimg1.webp",
    link: "#",
    buttontext: "View Course",
  },
  {
    title: "Rug Tufting Workshop",
    price: "$225",
    duration: "Ended",
    image: "public/images/workshopregimg2.webp",
    link: "#",
    buttontext: "View Course",
  },
  {
    title: "Sublimation Mug Workshop",
    price: "$45",
    duration: "3 hr",
    image: "public/images/workshopregimg3.webp",
    link: "#",
     buttontext: "View Course",
  },
  {
    title: "Life Drawing",
    price: "$30",
    duration: "3 hr",
    image: "public/images/workshopregimg4.webp",
    link: "#",
     buttontext: "View Course",
  },
];

export default function WorkshopsPage() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="MSYK Workshops" />

      {/* Navigation Tabs */}
      <div className="flex justify-center space-x-6 my-6">
        {["Workshops", "Orientations", "Free & Drop-In Events", "Courses", "Maker to Market"].map(
          (tab, index) => (
            <button
              key={index}
              className={`text-gray-700 font-medium pb-2 border-b-2 ${
                tab === "Workshops" ? "border-yellow-500 text-black font-bold" : "border-transparent"
              }`}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Workshop Cards */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid md:grid-cols-3 gap-6">
          {workshops.map((workshop, index) => (
            <div key={index} className="bg-gray-100 rounded-lg shadow-md overflow-hidden">
              {/* Image */}
              <img src={workshop.image} alt={workshop.title} className="w-full h-60 object-cover" />

              {/* Content */}
              <div className="p-5">
                <h3 className="text-lg font-semibold">{workshop.title}</h3>
                <a href="#" className="text-red-500 text-sm mt-2 block hover:underline">
                  Read More
                </a>
                <p className="text-sm text-gray-500">{workshop.duration}</p>
                <p className="font-bold mt-1">{workshop.price}</p>

                {/* Button */}
                <button className="mt-4 bg-yellow-500 text-white w-full py-2 rounded-md hover:bg-yellow-400 transition">
                  {workshop.buttontext}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}