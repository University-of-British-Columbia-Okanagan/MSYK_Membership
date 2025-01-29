import React from "react";
import Footer from "~/components/ui/Home/Footer";
import HeroSection from "@/components/ui/HeroSection";

const boardMembers = [
  {
    name: "Samuel MacDonald",
    role: "President",
    image: "https://via.placeholder.com/150", // Replace with actual image URL
    bio: "Sam is an aging perpetual fledgling committed to dipping his toes into as many crafts, disciplines, and metaphysical outlooks he can while ultimately mastering nothing...",
  },
  {
    name: "Michael Aide",
    role: "Treasurer",
    image: "https://via.placeholder.com/150",
    bio: "Recently new to Yellowknife, Michael was born in Abuja, Nigeria, and raised across Canada in Montreal, Wainwright, Kingston, and Ottawa...",
  },
  {
    name: "Mike Auty",
    role: "Secretary",
    image: "https://via.placeholder.com/150",
    bio: "Bio coming soon",
  },
  {
    name: "Carl Jr Kodakin-Yakeleya",
    role: "Director",
    image: "https://via.placeholder.com/150",
    bio: "Carl Jr. is Shuutotine (Mountain People) from the communities of Tulita and Delįne First Nations...",
  },
  {
    name: "Tiffany Kodakin-Yakeleya",
    role: "Director",
    image: "https://via.placeholder.com/150",
    bio: "Bio coming soon",
  },
];

export default function Board() {
  return (
    <main className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <HeroSection title="Board of Directors" />

      {/* Intro */}
      <section className="text-center py-12">
        <h2 className="text-3xl font-semibold text-orange-600">
          Meet our volunteer board members!
        </h2>
      </section>

      {/* Board Members Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {boardMembers.map((member, index) => (
          <div
            key={index}
            className="bg-white shadow-md rounded-lg overflow-hidden"
          >
            <img
              src={member.image}
              alt={member.name}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {member.name}
              </h3>
              <p className="text-sm text-orange-500 font-bold">{member.role}</p>
              <p className="text-gray-600 mt-2">{member.bio}</p>
            </div>
          </div>
        ))}
      </section>
      <Footer />
    </main>
  );
}
