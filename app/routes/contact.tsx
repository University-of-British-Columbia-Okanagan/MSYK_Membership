import React from "react";
import HeroSection from "@/components/ui/HeroSection"; // Import common Hero section
import Footer from "@/components/ui/Home/Footer";

export default function Contact() {
  return (
    <main className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <HeroSection title="Contact" />

      {/* Contact Information Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center py-12">
        {/* Address */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Address</h2>
          <p className="text-gray-600 mt-2">Unit 101</p>
          <p className="text-gray-600">5001 Forrest Drive</p>
          <p className="text-gray-600">Yellowknife, NT</p>
          <p className="text-gray-600">X1A 2A7</p>
        </div>

        {/* Contact Details */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Contact</h2>
          <p className="text-gray-600 mt-2">
            <a
              href="mailto:info@makerspaceyk.com"
              className="text-blue-600 hover:underline"
            >
              info@makerspaceyk.com
            </a>
          </p>
          <p className="text-gray-600">867-688-6672</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="#" className="text-gray-600 hover:text-gray-900">
              <i className="fab fa-facebook-f"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900">
              <i className="fab fa-instagram"></i>
            </a>
          </div>
        </div>

        {/* Public Open Hours */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Public Open Hours
          </h2>
          <p className="text-gray-600 mt-2">Tues: Closed</p>
          <p className="text-gray-600">Wed: Closed</p>
          <p className="text-gray-600">Thurs: 3:00 PM - 9:00 PM</p>
          <p className="text-gray-600">Fri: 3:00 PM - 9:00 PM</p>
          <p className="text-gray-600">Sat: 11:00 AM - 6:00 PM</p>
          <p className="text-gray-600">Sun: 11:00 AM - 6:00 PM</p>
          <p className="text-gray-600">Mon: Closed</p>
        </div>
      </section>

      {/* Google Maps Embed */}
      <section className="flex justify-center py-12">
        <iframe
          title="Makerspace YK Location"
          className="w-full md:w-3/4 h-96 rounded-lg border"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d19552.44590402278!2d-114.37676373940357!3d62.45402990672909!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x530c0c66e7b2ad37%3A0xc99b02de2446cf8c!2sMakerspace%20YK!5e0!3m2!1sen!2sca!4v1647473040402!5m2!1sen!2sca"
          allowFullScreen
          loading="lazy"
        ></iframe>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
