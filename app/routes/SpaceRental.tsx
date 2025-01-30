import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";
import RentalRates from "@/components/ui/Spaces and Services/SpaceRentalInfo"; 

export default function SpaceRental() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Space Rental" />

      {/* Rental Rates Section */}
      <RentalRates />

      {/* Background Image Section */}
      <section
        className="h-[500px] bg-cover bg-center"
        style={{ backgroundImage: "url('/images/SpaceRentalimg.avif')" }}
      ></section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
