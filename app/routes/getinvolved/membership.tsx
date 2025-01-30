//Link the membership plan to payment system in Stripe. 
import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";

export default function MembershipPage() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Choose Your Membership Plan" />

      {/* Membership Plans */}
      <section className="bg-gray-900 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-white text-center text-3xl font-semibold mb-10">
            Choose your Membership Plan
          </h2>

          {/* Membership Cards Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {membershipPlans.map((plan, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-lg overflow-hidden text-center p-8"
              >
                <h3 className="text-xl font-semibold text-gray-800">
                  {plan.title}
                </h3>
                <p className="text-gray-600 mt-2">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 text-sm"> /month</span>
                </div>
                <button className="mt-4 bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition">
                  Select
                </button>
                <ul className="text-left text-gray-700 mt-6 space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center">
                      <span className="text-yellow-500 mr-2">→</span> {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}

// Membership Plan Data
const membershipPlans = [
  {
    title: "Community Member",
    description: "Support Makerspace YK as a community member",
    price: 35,
    features: [
      "Hotdesk access in Artspace during drop-in times",
      "Access to sewing machines and serger in Artspace",
      "Social media promotion for your startup or initiative",
      "5% discount on all MSYK workshops",
    ],
  },
  {
    title: "Makerspace Member",
    description:
      "MSYK membership now covers Artspace, Hackspace, & Shopspace for just $50/month!",
    price: 50,
    features: [
      "Hotdesk access in Artspace during drop-in times",
      "Access to the woodshop & digital lab tools and equipment",
      "Tablesaw - Compound mitre saw - Bandsaw - Scroll saw",
      "Joiner - Planer - Disc & Belt sander - Drill Press",
      "Hand and portable tools also available (drills, jigsaws, etc.)",
      "Laser cutters, 3D printers, CNC milling, circuits, soldering",
      "Access to MSYK laptops with software subscriptions",
      "2 hours of 3D print time per month ($5/30 min after)",
      "60 minutes of laser/CNC cut time per month ($1/min after)",
      "Additional Hackspace and Shop orientations required",
    ],
  },
  {
    title: "Drop-In 10 Pass",
    description:
      "Not ready for a membership? Get a Drop-In 10 pass & save $10!",
    price: 90,
    features: [
      "10 drop-in sessions for the Artspace, Shop, or Digital lab",
      "**Shop Orientation required for Wood Shop",
      "**Training may be required for Hackspace equipment",
    ],
  },
];
