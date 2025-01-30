import HeroSection from "@/components/ui/MakertoMarket/HeroSection";

import Footer from "~/components/ui/Home/Footer";
export default function FabricationServices() {
    const examples = [
        { title: "Keychains", description: "Custom laser-cut keychains made from acrylic or wood.", icon: "🔑" },
        { title: "Coasters & Medallions", description: "Celebrate events with custom laser-cut coasters.", icon: "🥇" },
        { title: "CNC Signage", description: "Craft eye-catching business or home decor signs.", icon: "📍" },
        { title: "Displays", description: "Showcase products with custom-designed displays.", icon: "🖼" },
        { title: "Embroidered Patches", description: "Create detailed embroidered patches for uniforms.", icon: "🧵" },
        { title: "Digitization Services", description: "Convert designs into 3D models and digital formats.", icon: "💻" },
      ];
  return (
    <main>
      {/* Hero Section */}
      <HeroSection
        title="Fabrication Services"
        backgroundImage="public/images/Fabricationservicesimg.avif"
        description="Have a project you think Makerspace YK could help out with on the fabrication side? Email us at info@makerspaceyk.com or using the contact form below with the details, timeline, and any relevant images, and we'll respond as soon as possible"
      />

      <section className="bg-[rgb(107,116,189)] text-white py-16 px-4">
        <div className="container mx-auto">
          {/* Examples Section */}
          <h2 className="text-center text-3xl font-bold mb-8">
            Examples of what we can make:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {examples.map((example, index) => (
              <div key={index} className="p-4">
                <div className="text-4xl mb-4">{example.icon}</div>
                <h3 className="text-xl font-semibold">{example.title}</h3>
                <p className="text-sm mt-2">{example.description}</p>
              </div>
            ))}
          </div>

          {/* Contact Form Section */}
          <div className="mt-16">
            <h2 className="text-center text-3xl font-bold mb-6">Contact Us</h2>
            <form className="max-w-3xl mx-auto bg-white p-6 rounded-md shadow-lg text-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name *"
                  className="border p-2 rounded w-full"
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="border p-2 rounded w-full"
                />
              </div>
              <input
                type="email"
                placeholder="Email *"
                className="border p-2 rounded w-full mt-4"
                required
              />
              <textarea
                placeholder="Write a message"
                className="border p-2 rounded w-full mt-4"
              ></textarea>
              <div className="mt-4">
                <label className="block text-sm font-medium">File Upload</label>
                <input type="file" className="border p-2 rounded w-full mt-2" />
              </div>
              <button className="w-full bg-yellow-500 text-white font-bold py-2 px-4 rounded mt-4 hover:bg-yellow-600">
                Submit
              </button>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
