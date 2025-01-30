//Link the Volunteer form with the google form or create a separate volunteer form and link it.
//Change the hardcoded volunteer opportunities to dynamic state that fetches data from the db.
import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";

export default function VolunteerPage() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Support the MSYK Community!" />

      {/* Volunteer Opportunities */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-semibold text-gray-800">
          Want to support the MSYK community?
        </h2>
        <p className="text-xl text-gray-600 mt-2">Here's how you can help!</p>

        {/* Volunteer Roles Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {volunteerRoles.map((role, index) => (
            <div
              key={index}
              className="border-2 border-orange-400 rounded-lg p-6 shadow-md bg-white"
            >
              <div className="flex justify-center mb-4">
                <img src={role.icon} alt={role.title} className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">
                {role.title}
              </h3>
              <p className="text-gray-600 mt-2">{role.description}</p>
            </div>
          ))}
        </div>

        {/* Volunteer Form Link */}
        <p className="text-orange-500 font-semibold mt-10">
          Interested in becoming a volunteer? Fill out the form below!
        </p>
        <a
          href="YOUR_VOLUNTEER_FORM_LINK"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition"
        >
          Volunteer Form Link
        </a>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}

// Data for Volunteer Roles
const volunteerRoles = [
  {
    title: "Woodshop Supervisor",
    description:
      "Help people with their woodworking projects and ensure they stay safe and follow community guidelines.",
    icon: "/images/icons/woodshop.png",
  },
  {
    title: "Hackspace Supervisor",
    description:
      "Support people with digital fabrication projects and ensure they follow community guidelines.",
    icon: "/images/icons/hackspace.png",
  },
  {
    title: "Front Desk Support",
    description:
      "Help visitors sign in for events, collect payments, and give short tours.",
    icon: "/images/icons/frontdesk.png",
  },
  {
    title: "Workshop Facilitator",
    description: "Have an idea for a workshop? Host it at MSYK!",
    icon: "/images/icons/workshop.png",
  },
  {
    title: "Social Media & Marketing",
    description:
      "Help update MSYK’s social media, create newsletters, and share content from events.",
    icon: "/images/icons/socialmedia.png",
  },
  {
    title: "General Event Volunteer",
    description:
      "Assist with events like trade shows, concerts, and workshops. Volunteers will be notified when needed.",
    icon: "/images/icons/event.png",
  },
];
