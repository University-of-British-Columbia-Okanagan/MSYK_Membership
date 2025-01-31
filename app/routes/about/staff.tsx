import React from "react";
import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";

const staffMembers = [
  {
    name: "Aileen Ling",
    role: "Executive Director",
    pronouns: "(she/her)",
    image: "/images/staffimg1.avif",
    bio: "Aileen is a person that wears a lot of hats! Her background is in design, community, and social enterprise development...",
  },
  {
    name: "Jon Soderberg",
    role: "Hackspace Manager",
    pronouns: "(he/him)",
    image: "/images/staffimg2.avif",
    bio: "Jon is an apprentice machinist and more recently received a background in mechanical engineering...",
  },
  {
    name: "Lauren Pelc-McArthur",
    role: "Program Coordinator",
    pronouns: "(she/her)",
    image: "/images/staffimg3.avif",
    bio: "Lauren has a background in fine arts, and more recently, design. Her professional experience includes STEM program coordination...",
  },
];

export default function Staff() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <HeroSection title="Our Team" />

      {/* Middle Section */}
      <section className="flex-grow flex flex-col items-center py-16">
        <h2 className="text-3xl font-semibold text-orange-600">Meet our Staff</h2>
        <div className="w-16 h-1 bg-gray-400 mx-auto mt-2"></div>

        {/* Staff Grid */}
        <div className="container mx-auto px-6 mt-10 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          {staffMembers.map((staff, index) => (
            <div key={index} className="bg-white shadow-lg rounded-lg p-6 flex flex-col items-center">
              <img
                src={staff.image}
                alt={staff.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              />
              <h3 className="text-lg font-semibold mt-4">{staff.name}</h3>
              <p className="text-sm font-medium text-gray-600">{staff.pronouns}</p>
              <p className="text-orange-500 font-bold">{staff.role}</p>
              <p className="text-gray-600 mt-3">{staff.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer at the bottom */}
      <Footer />
    </main>
  );
}
