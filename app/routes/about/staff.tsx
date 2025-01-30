import React from "react";
import HeroSection from "@/components/ui/HeroSection"; // Import the common Hero section
import Footer from "@/components/ui/Home/Footer"; 
const staffMembers = [
  {
    name: "Aileen Ling",
    role: "Executive Director",
    pronouns: "(she/her)",
    image: "https://via.placeholder.com/150", // Replace with actual image
    bio: "Aileen is a person that wears a lot of hats! Her background is in design, community, and social enterprise development...",
  },
  {
    name: "Jon Soderberg",
    role: "Hackspace Manager",
    pronouns: "(he/him)",
    image: "https://via.placeholder.com/150",
    bio: "Jon is an apprentice machinist and more recently received a background in mechanical engineering...",
  },
  {
    name: "Lauren Pelc-McArthur",
    role: "Program Coordinator",
    pronouns: "(she/her)",
    image: "https://via.placeholder.com/150",
    bio: "Lauren has a background in fine arts, and more recently, design. Her professional experience includes STEM program coordination...",
  },
];

export default function Staff() {
  return (
    <main className="container mx-auto px-4 py-12">
      {/* Hero Section */}
     
      <HeroSection title="Our Team" />
      {/* Intro Section */}
      <section className="text-center py-12">
        <h2 className="text-3xl font-semibold text-orange-600">
          Meet our Staff
        </h2>
        <div className="w-16 h-1 bg-gray-400 mx-auto mt-2"></div>
      </section>

      {/* Staff Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        {staffMembers.map((staff, index) => (
          <div key={index} className="flex flex-col items-center text-gray-900">
            <img
              src={staff.image}
              alt={staff.name}
              className="w-32 h-32 rounded-full object-cover"
            />
            <h3 className="text-lg font-semibold mt-4">{staff.name}</h3>
            <p className="text-sm font-medium text-gray-600">
              {staff.pronouns}
            </p>
            <p className="text-orange-500 font-bold">{staff.role}</p>
            <p className="text-gray-600 mt-2 px-4">{staff.bio}</p>
          </div>
        ))}
      </section>
      <Footer />
    </main>
  );
}
