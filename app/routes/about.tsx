import { Outlet } from "react-router-dom";
import AboutHero from "~/components/ui/About/AboutHero";
import MissionStatement from "~/components/ui/About/MissionStatement";
import VisionSection from "~/components/ui/About/VisionSection";
import ValuesGrid from "~/components/ui/About/ValuesGrid";
import StrategySection from "~/components/ui/About/StrategySection";
import Footer from "~/components/ui/Home/Footer";

export default function About() {
  return (
    <main>
      <AboutHero />
      <MissionStatement />
      <VisionSection />
      <ValuesGrid />
      <StrategySection />

      {/* This is where Board, Staff, and Contact will be rendered */}
      <Outlet />

      <Footer />
    </main>
  );
}
