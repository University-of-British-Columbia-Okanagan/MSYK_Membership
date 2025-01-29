import Footer from "@/components/ui/Home/Footer";
import HeroSection from "~/components/ui/HeroSection";

const resources = [
  {
    title: "Community Guidelines",
    description: "Understand what is expected of users at Makerspace YK, as well as important do's and don'ts.",
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
    description: "Learn more about materials you can and can't bring to MSYK, as well as information for what's available to purchase.",
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
    <main className="container mx-auto px-4 py-12">
        <HeroSection title = "Resource Toolbox"/>
      <h2 className="text-center text-3xl font-bold mb-8">Resource Toolbox</h2>

      {/* Resource Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {resources.map((resource, index) => (
          <div key={index} className="relative">
            {/* Background Image */}
            <img src={resource.image} alt={resource.title} className="w-full h-64 object-cover rounded-lg" />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-center items-center text-white p-6 rounded-lg">
              <h3 className="text-xl font-bold">{resource.title}</h3>
              <p className="text-sm mt-2 text-center">{resource.description}</p>

              {/* Buttons */}
              <div className="mt-4 flex flex-col gap-2">
                {resource.buttons.map((button, idx) => (
                  <a
                    key={idx}
                    href={button.link}
                    className="bg-orange-500 text-white text-sm px-4 py-2 rounded-full text-center hover:bg-orange-600 transition"
                  >
                    {button.text}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
