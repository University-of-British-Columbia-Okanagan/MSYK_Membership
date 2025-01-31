import React from "react";
import Footer from "~/components/ui/Home/Footer";
import HeroSection from "@/components/ui/HeroSection";

const boardMembers = [
  {
    name: "Samuel MacDonald",
    role: "President",
    image: "/images/volunteerboardimg1.avif", 
    bio: "Sam is an aging perpetual fledgling committed to dipping his toes into as many crafts, disciplines, and metaphysical outlooks he can while ultimately mastering nothing...",
  },
  {
    name: "Michael Aide",
    role: "Treasurer",
    image: "/images/volunteerboardimg2.avif",
    bio: "Recently new to Yellowknife, Michael was born in Abuja, Nigeria, and raised across Canada in Montreal, Wainwright, Kingston, and Ottawa...",
  },
  {
    name: "Mike Auty",
    role: "Secretary",
    image: "/images/volunteerboardimg3.avif",
    bio: "Bio coming soon",
  },
  {
    name: "Carl Jr Kodakin-Yakeleya",
    role: "Director",
    image: "/images/volunteerboardimg4.avif",
    bio: "Carl Jr. is Shuutotine (Mountain People) from the communities of Tulita and Delįne First Nations...",
  },
  {
    name: "Tiffany Kodakin-Yakeleya",
    role: "Director",
    image: "/images/volunteerboardimg5.jpg",
    bio: "Bio coming soon",
  },
];

export default function Board() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Board of Directors" />

      {/* Intro */}
      <section className="text-center py-12">
        <h2 className="text-3xl font-semibold text-orange-600">
          Meet our volunteer board members!
        </h2>
      </section>

      {/* Board Members Grid */}
      <section className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {boardMembers.map((member, index) => (
            <div
              key={index}
              className="bg-white shadow-lg rounded-lg overflow-hidden flex flex-col"
            >
              <img
                src={member.image}
                alt={member.name}
                className="w-full h-56 object-cover"
              />
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-orange-500 font-bold">{member.role}</p>
                <p className="text-gray-600 mt-2 flex-grow">{member.bio}</p>
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
