import AboutHero from "~/components/ui/About/AboutHero";
import MissionStatement from "~/components/ui/About/MissionStatement";
import VisionSection from "~/components/ui/About/VisionSection";
import ValuesGrid from "~/components/ui/About/ValuesGrid";
import StrategySection from "~/components/ui/About/StrategySection";
import Footer from "~/components/ui/Home/Footer";

export default function about() {
  return (
    <main>
      <AboutHero />
      <MissionStatement />
      <VisionSection />
      <ValuesGrid />
      <StrategySection />
      <Footer />
    </main>
  );
}
