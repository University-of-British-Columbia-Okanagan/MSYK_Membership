import type { Route } from "./+types/home";
import HeroSection from "~/components/ui/Home/HeroSection";
import WhatsHappening from "~/components/ui/Home/WhatHappening";
import FacilitiesSection from "~/components/ui/Home/Facilities";
import SpacesSection from "~/components/ui/Home/Spaces";
import GetInvolved from "~/components/ui/Home/GetInvolved";
import EventCalendar from "~/components/ui/Home/eventcalendar";
import SupportingPartners from "~/components/ui/Home/Supportingpartners";
import NewsletterSignup from "~/components/ui/Home/NewsLetterSignup";
import Footer from "~/components/ui/Home/Footer";

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
      {/* <SupportingPartners /> */}
      <NewsletterSignup />
      <Footer />
    </main>
  );
}
