import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";
import EventCalendarComponent from "@/components/ui/Home/eventcalendar"; // Renamed to avoid conflict

export default function EventCalendarPage() { // Unique component name
  return (
    <main>
      <HeroSection title="Event Calendar" />
      <EventCalendarComponent />
      <Footer />
    </main>
  );
}
