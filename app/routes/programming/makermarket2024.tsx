import HeroSection from "@/components/ui/MakertoMarket/HeroSection";
import MakerMarketInfo from "~/components/ui/MakertoMarket/MakerMarketInfo";
import MakerToMarketTraining from "~/components/ui/MakertoMarket/MtoMTraining";
import VendorCall from "~/components/ui/MakertoMarket/VendorCall";
import Footer from "~/components/ui/Home/Footer";
export default function Market2024() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection
        title="Maker to Market Program"
        backgroundImage="public/images/Maker2024img.avif"
      />
      <MakerMarketInfo />
      <VendorCall />
      <MakerToMarketTraining />
      <Footer />
    </main>
  );
}
