import type { Route } from "./+types/home";
import HeroSection from "~/components/ui/HeroSection";
import WhatsHappening from "~/components/ui/WhatHappening";
import FacilitiesSection from "~/components/ui/Facilities";
import SpacesSection from "~/components/ui/Spaces";
import GetInvolved from "~/components/ui/GetInvolved";
import EventCalendar from "~/components/ui/eventcalendar";
import SupportingPartners from "~/components/ui/Supportingpartners";
import NewsletterSignup from "~/components/ui/NewsLetterSignup";
import Footer from "~/components/ui/Footer";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Makerspace YK" },
    { name: "description", content: "Welcome to Makerspace YK!" },
  ];
}

export default function Home() {
  return (
    <main>
      <HeroSection />
      <WhatsHappening />
      <FacilitiesSection />
      <SpacesSection />
      <GetInvolved />
      <EventCalendar />
      <SupportingPartners />
      <NewsletterSignup />
      <Footer />
    </main>
  );
}
