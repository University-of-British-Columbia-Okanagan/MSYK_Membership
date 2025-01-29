import HeroSection from "@/components/ui/Spaces and Services/SpaceHero";
import SpacesGrid from "@/components/ui/Spaces and Services/SpaceGrid";
import Footer from "@/components/ui/Home/Footer";
import SpaceHero from "@/components/ui/Spaces and Services/SpaceHero";

export default function Spaces() {
  return (
    <main>
      <SpaceHero />

      <SpacesGrid />

      <Footer />
    </main>
  );
}
