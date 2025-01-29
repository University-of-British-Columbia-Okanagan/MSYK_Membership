import HeroSection from "@/components/ui/HeroSection";
import ApplyToJoin from "~/components/ui/MuralProject/AsktoJoin";
import Footer from "@/components/ui/Home/Footer";

export default function MuralProject() {
  return (
    <main>
      {/* Hero Section with Background Image */}
      <HeroSection
        title=""
      />

      {/* Call-to-Action Section */}
      <section className="container mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Section - Orange Call to Action */}
        <div className="bg-orange-500 text-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold">Bring a Mural to Life with Us!</h2>
          <p className="text-lg mt-2 font-semibold">Starting Nov 2023</p>
          <p className="mt-4">
            Are you a muralist or animator interested in collaborating with
            other artists to transform and enhance the visual landscape of
            Yellowknife?
          </p>
          <p className="mt-4">
            Or maybe you're interested in learning more about mural-making, or
            about new ways of combining digital and traditional art forms!
          </p>
          <p className="mt-4 font-semibold italic">
            Well then - Join us for the{" "}
            <strong>Augment YK Mural Project!</strong>
          </p>
          <p className="mt-4">
            We’re partnering with{" "}
            <a href="#" className="underline font-bold">
              Western Arctic Moving Pictures
            </a>
            to connect artists in the creation of six new augmented reality (AR)
            murals to be installed throughout Yellowknife in Spring 2024!
          </p>
          <button className="mt-6 px-6 py-2 bg-blue-600 text-white font-semibold rounded-md">
            Apply Now
          </button>
        </div>

        {/* Right Section - Mural Image */}
        <div>
          <img
            src="/path-to-mural-banner.jpg"
            alt="Augment YK Mural Project"
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      </section>

      {/* Augmented Reality Info Section */}
      <section className="bg-indigo-500 text-white py-12 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold">
            What is an <span className="italic">Augmented Reality Mural?</span>
          </h2>
          <p className="mt-4 max-w-2xl mx-auto">
            Augmented reality (AR) murals use digital technology to overlay 2D
            and 3D animations on artworks placed in the physical environment.
            With an AR mural, viewers can use a smartphone app like{" "}
            <a href="#" className="underline">
              Artivive
            </a>
            , to turn their phone into a magic lens that transforms the artwork
            into a fully immersive experience.
          </p>
          <p className="mt-4">
            This gives artists the opportunity to play with the viewer in new
            and exciting ways, where an artwork can completely change depending
            on how the viewer interacts with it.
          </p>
        </div>
      </section>
      <section>
        <ApplyToJoin />
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
