import Footer from "@/components/ui/Home/Footer";
import HeroSection from "~/components/ui/HeroSection";

const spaces = [
  {
    name: "Shopspace",
    subtitle: "The Woodshop",
    image: "public/images/gallery section img1.avif", 
    color: "bg-yellow-500",
    items: [
      "Sawstop Table Saw",
      "Compound Mitre Saw",
      "13” and 15” Thickness Planer",
      "Vertical Bandsaw",
      "Jointer",
      "Scroll Saw",
      "Belt & Disc Sander",
      "Drill Press",
      "Router Table",
      "X-Carve CNC (75cmx75cm)",
      "Various Hand Tools",
    ],
  },
  {
    name: "Hackspace",
    subtitle: "The Digital Fabrication Lab",
    image: "public/images/gallerysection img2.avif",
    color: "bg-indigo-600",
    items: [
      "Epilog FusionEdge CO2 Laser Cutters",
      "Prusa 3D Printer",
      "Bambu Labs 3D Printer",
      "Electronics & Soldering Station",
      "Cricut Machines",
      "Sawgrass SG1000 Sublimation Printer (up to 11x17”)",
      "Brother Persona Embroidery Machine",
      "Nomad CNC",
      "Flat and tumbler heat press",
    ],
  },
  {
    name: "Artspace",
    subtitle: "Multi-purpose Creative Space",
    image: "public/images/SpaceRentalimg.avif",
    color: "bg-orange-500",
    items: [
      "Singer Domestic Sewing Machines",
      "Juki Industrial Straight-Stitch Sewing Machine",
      "Fur sewing machine",
      "Domestic Sergers",
      "Screenprinting Equipment (Exposure unit, Screens, Flash dryer)",
      "Rug Tufting Guns (cut pile) and 3x3’ tufting frames",
      "Large light table",
    ],
  },
];

export default function SpacesEquipment() {
  return (
    <main>
      {/* Hero Section (Reduced Height) */}
      <HeroSection title="Spaces and Equipment" />

      {/* Title */}
      <h2 className="text-center text-2xl font-bold mb-6">
        See the list below each space to see what tools and equipment we have available!
      </h2>

      {/* Spaces Grid */}
      <section className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {spaces.map((space, index) => (
            <div key={index} className="shadow-lg rounded-lg overflow-hidden bg-white">
              {/* Image */}
              <img src={space.image} alt={space.name} className="w-full h-56 object-cover" />

              {/* Description */}
              <div className={`p-6 ${space.color} text-white flex flex-col justify-between h-full`}>
                <div>
                  <h3 className="text-lg font-bold">{space.name}</h3>
                  <p className="text-sm font-semibold">{space.subtitle}</p>
                  <ul className="mt-4 text-sm list-disc list-inside space-y-1">
                    {space.items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
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
