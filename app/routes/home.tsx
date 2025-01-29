import type { Route } from "./+types/home";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <main>
      <section className="relative h-[600px] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg')`,
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="container mx-auto px-4 relative text-white">
          <div className="max-w-2xl">
            <img
              src="https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg"
              alt="Makerspace YK Logo"
              className="w-32 h-32 mb-6"
            />
            <h1 className="text-5xl font-bold mb-4">Makerspace YK</h1>
            <p className="text-xl mb-8">
              Makerspace YK is a registered non-profit in Yellowknife, Northwest
              Territories. We build community with hands-on learning
              opportunities, access to shared space/tools, and skills-building
              programs.
            </p>
            <Button
              size="lg"
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              Browse Memberships
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-[#FF7755] mb-12">
            What&apos;s Happening?
          </h2>
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-[#6B6EE5] rounded-lg p-8 text-white">
                <h3 className="text-3xl font-bold mb-4">
                  12 Days of Workshops
                </h3>
                <p className="mb-6">
                  Get into the holiday spirit with 12 Days of holiday-themed
                  workshops at MSYK!
                </p>
                <Button className="bg-white text-[#6B6EE5] hover:bg-gray-100">
                  Learn More
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto flex flex-wrap md:flex-nowrap items-center gap-8">
          {/* Left Side: Text Content */}
          <div className="flex-1 bg-gray-700 text-white p-8 rounded-lg">
            <h2 className="text-4xl font-bold mb-4">Our Facilities</h2>
            <p className="text-lg mb-6">
              We want to create a space where we can host workshops and work on
              projects, fostering a collaborative environment for all.
            </p>
            <p className="text-lg">
              Join one of our workshops, become a member, or drop in to get
              making!
            </p>
          </div>

          {/* Right Side: Image */}
          <div className="flex-1">
            <img
              src="https://sjc.microlink.io/3UMVMIwFkaLgGJPRMk1CufTQH3jIGhRTSYX6nADLrgUu0b6wbTgC5__71QWicGqMcM-rWEDf2KwHjj_S0n2ROg.jpeg"
              alt="Our Facilities"
              className="rounded-lg shadow-lg"
            />
          </div>
        </div>
      </section>
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shopspace */}
            <div className="bg-yellow-500 text-white p-8 rounded-lg shadow-lg">
              <h3 className="text-3xl font-bold mb-4">Shopspace</h3>
              <p className="text-lg">
                Get hands-on! Come use our fully outfitted woodshop to get
                building. From small-scale to large-scale ideas, we have the
                tools and equipment you need to complete your project.
              </p>
            </div>

            {/* Hackspace */}
            <div className="bg-indigo-500 text-white p-8 rounded-lg shadow-lg">
              <h3 className="text-3xl font-bold mb-4">Hackspace</h3>
              <p className="text-lg">
                Making goes digital! Join us to get tech-savvy at Hackspace.
                Learn skills like coding and electronics to use in your own
                projects, collaborations, and more.
              </p>
            </div>

            {/* Artspace */}
            <div className="bg-orange-500 text-white p-8 rounded-lg shadow-lg">
              <h3 className="text-3xl font-bold mb-4">Artspace</h3>
              <p className="text-lg">
                Get creative with the community. Artspace hosts events and
                workshops by other artists, makers, and community organizations.
                Join a workshop or even host one yourself!
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="py-16 bg-gray-700 text-white">
        <div className="container mx-auto px-4">
          {/* Section Title */}
          <h2 className="text-4xl font-bold text-center mb-12">Get Involved</h2>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Rent Our Space */}
            <div className="bg-white text-gray-800 rounded-lg shadow-lg p-8 border-4 border-indigo-400">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <svg
                  className="h-16 w-16 text-indigo-400 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z" />
                </svg>
                {/* Title & Text */}
                <h3 className="text-2xl font-bold mb-4">Rent our space!</h3>
                <p className="text-lg mb-6">
                  Individuals and organizations can book the Artspace for
                  community events, workshops, exhibitions, and more!
                </p>
                {/* Button */}
                <button className="bg-indigo-400 text-white px-6 py-3 rounded-lg hover:bg-indigo-500">
                  Book Now
                </button>
              </div>
            </div>

            {/* Volunteer */}
            <div className="bg-white text-gray-800 rounded-lg shadow-lg p-8 border-4 border-orange-400">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <svg
                  className="h-16 w-16 text-orange-400 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z" />
                </svg>
                {/* Title & Text */}
                <h3 className="text-2xl font-bold mb-4">Volunteer</h3>
                <p className="text-lg mb-6">
                  Join our volunteer roster to get more involved with our work!
                </p>
                {/* Button */}
                <button className="bg-orange-400 text-white px-6 py-3 rounded-lg hover:bg-orange-500">
                  Apply Now
                </button>
              </div>
            </div>

            {/* Sponsorship */}
            <div className="bg-white text-gray-800 rounded-lg shadow-lg p-8 border-4 border-yellow-400">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <svg
                  className="h-16 w-16 text-yellow-400 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z" />
                </svg>
                {/* Title & Text */}
                <h3 className="text-2xl font-bold mb-4">Sponsorship</h3>
                <p className="text-lg mb-6">
                  Help further your impact in the community by supporting our
                  programming and events through sponsorship.
                </p>
                {/* Button */}
                <button className="bg-yellow-400 text-white px-6 py-3 rounded-lg hover:bg-yellow-500">
                  Let's Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
