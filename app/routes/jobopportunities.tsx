import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";

export default function JobOpportunities() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Job Opportunities" />

      {/* Job Opportunities Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Woodshop Instructors */}
          <div className="bg-yellow-500 text-white p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold">Woodshop Instructors</h2>
            <p className="mt-2 font-semibold">Contract</p>
            <button className="mt-4 bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition">
              Apply Now
            </button>
          </div>

          {/* Job Details */}
          <div className="bg-white text-gray-800 p-8 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold">Are you good with wood?</h3>
            <p className="mt-2">
              We are looking for contract woodshop instructors to help us with
              our "Shop Skills Development Initiative" between January and
              August 2025.
            </p>
            <p className="mt-2">
              Sessions are in the evenings and weekends, with hours varying
              between **3 to 24 hours a month**.
            </p>
            <p className="mt-2 font-semibold">
              Rolling applications open until **Dec. 31, 2025**.
            </p>
            <p className="mt-2 text-red-600 font-semibold">
              Got questions or want to apply? Email us at{" "}
              <a href="mailto:info@makerspaceyk.com" className="underline">
                info@makerspaceyk.com
              </a>{" "}
              with your resume!
            </p>
          </div>
        </div>

        {/* Freelance Opportunities */}
        <div className="grid md:grid-cols-2 gap-8 mt-12">
          <div className="bg-indigo-600 text-white p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold">Freelance Opportunities</h2>
            <p className="mt-2 font-semibold">Contract</p>
            <button className="mt-4 bg-yellow-400 text-black px-6 py-2 rounded-md hover:bg-yellow-300 transition">
              Get in Touch
            </button>
          </div>

          {/* Freelance Details */}
          <div className="bg-white text-gray-800 p-8 rounded-lg shadow-lg">
            <p>
              We need folks with experience in **graphics, communications, and
              information design** to help us with outreach, marketing, and
              training materials.
            </p>
            <p className="mt-2">
              If you have these skills, **send us your resume & portfolio** at
              <a
                href="mailto:info@makerspaceyk.com"
                className="underline text-red-600"
              >
                info@makerspaceyk.com
              </a>
            </p>
            <ul className="mt-4 list-disc ml-6">
              <li>Communications and Marketing</li>
              <li>Graphic Design</li>
              <li>Information Design</li>
            </ul>
          </div>
        </div>
      </section>
      {/* Open Application (Future Consideration) Section */}
      <section
        className="relative bg-cover bg-center py-16"
        style={{
          backgroundImage: "url('public/images/jobopportunitiesimg.avif')",
        }}
      >
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold">
            Open Application (Future Consideration)
          </h2>
          <p className="mt-4 text-gray-700">
            If you are experienced in **trades, arts, digital
            fabrication/technologies, or entrepreneurship**, feel free to send
            us your resume! We'll keep it on record and reach out if we need
            your expertise.
          </p>
          <button className="mt-4 bg-yellow-500 text-white px-6 py-2 rounded-md hover:bg-yellow-400 transition">
            Say Hi
          </button>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
