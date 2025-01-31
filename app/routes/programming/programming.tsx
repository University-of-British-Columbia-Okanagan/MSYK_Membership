import HeroSection from "@/components/ui/HeroSection";

import Footer from "@/components/ui/Home/Footer";

import ProgrammingGrid from "~/components/ui/Programming/ProgrammingGrid";

export default function Spaces() {
  return (
    <main>
         <HeroSection title="Programming" />

      <ProgrammingGrid />

      <Footer />
    </main>
  );
}
