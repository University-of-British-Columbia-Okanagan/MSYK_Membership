import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WhatsHappening = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-[#FF7755] mb-12">What&apos;s Happening?</h2>
        <div className="relative">
          <Button variant="outline" size="icon" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#6B6EE5] rounded-lg p-8 text-white">
              <h3 className="text-3xl font-bold mb-4">12 Days of Workshops</h3>
              <p className="mb-6">Get into the holiday spirit with 12 Days of holiday-themed workshops at MSYK!</p>
              <Button className="bg-white text-[#6B6EE5] hover:bg-gray-100">Learn More</Button>
            </div>
          </div>
          <Button variant="outline" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default WhatsHappening;
