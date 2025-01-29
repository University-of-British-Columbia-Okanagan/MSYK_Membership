import HeroSection from "@/components/ui/HeroSection";
import Footer from "~/components/ui/Home/Footer";
import RentalRates from "~/components/ui/Spaces and Services/SpaceRentalInfo"
export default function SpaceRental() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection
        title="Space Rental"
      />
      <RentalRates/>
      <Footer />
    </main>
  );
}
