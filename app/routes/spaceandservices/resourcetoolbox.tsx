import Footer from "@/components/ui/Home/Footer";
import HeroSection from "~/components/ui/HeroSection";

const resources = [
  {
    title: "Community Guidelines",
    description: "Understand what is expected of users at Makerspace YK, as well as important do’s and don’ts.",
    image: "public/images/resourcetoolboximg1.avif",
    buttons: [
      { text: "Community Guidelines", link: "/community-guidelines" },
      { text: "Liability Waiver", link: "/liability-waiver" },
    ],
  },
  {
    title: "Orientations & Training",
    description: "Learn what orientation and training is needed to use the tools and equipment at Makerspace YK.",
    image: "public/images/resourcetoolboximg2.avif",
    buttons: [
      { text: "Learn More", link: "/orientation-training" },
      { text: "Register for Training", link: "/training-register" },
    ],
  },
  {
    title: "Safety",
    description: "Stay safe! Read up on our safety policies and learn more about the Safe Operating Procedures (SOPs).",
    image: "public/images/resourcetoolboximg3.avif",
    buttons: [
      { text: "Safety Policy", link: "/safety-policy" },
      { text: "SOP’s", link: "/sop" },
    ],
  },
  {
    title: "Materials",
    description: "Learn more about materials you can and can’t bring to MSYK, as well as information for what’s available to purchase.",
    image: "public/images/resourcetoolboximg4.avif",
    buttons: [
      { text: "Wood Shop Materials", link: "/woodshop-materials" },
      { text: "Hackspace Materials", link: "/hackspace-materials" },
    ],
  },
  {
    title: "Youth (<30)",
    description: "For users under 30, read more about our youth policies here. Under 18? Make sure to get a youth waiver signed for access.",
    image: "public/images/resourcetoolboximg5.avif",
    buttons: [
      { text: "Youth Policy", link: "/youth-policy" },
      { text: "Youth Waiver", link: "/youth-waiver" },
    ],
  },
  {
    title: "Community-led Events",
    description: "COMING SOON",
    image: "public/images/resourcetoolboximg6.avif",
    buttons: [],
  },
];

export default function ResourceToolbox() {
  return (
    <main>
      {/* Hero Section with Reduced Height */}
     <HeroSection title = "Resource Toolbox" />
      <section>

        {/* Grid Layout for Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {resources.map((resource, index) => (
            <div key={index} className="relative -lg overflow-hidden shadow-lg">
              {/* Background Image */}
              <img src={resource.image} alt={resource.title} className="w-full h-96 object-cover" />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center text-center p-6 text-white transition-opacity duration-300">
                <h3 className="text-2xl font-bold">{resource.title}</h3>
                <p className="text-sm mb-4">{resource.description}</p>

                {/* Buttons */}
                <div className="flex flex-col gap-2">
                  {resource.buttons.map((button, idx) => (
                    <a
                      key={idx}
                      href={button.link}
                      className="bg-orange-500 text-white text-center py-2 px-4 rounded-md hover:bg-orange-600 transition"
                    >
                      {button.text}
                    </a>
                  ))}
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
