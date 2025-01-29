import HeroSection from "@/components/ui/HeroSection";
import RegisterForWorkshop from "@/components/ui/Programming/RegisterWorkshop";
import EventWorkshopCalendar from "@/components/ui/Programming/EventWorkshopCalendar";
import Footer from "@/components/ui/Home/Footer";

export default function Programming() {
  return (
    <main>
      <HeroSection title = "Programming"/>

      <section className="grid grid-cols-1 md:grid-cols-2">
        <RegisterForWorkshop />
        <EventWorkshopCalendar />
      </section>

      <Footer />
    </main>
  );
}
