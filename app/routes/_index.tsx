import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function Index() {
  return (
    <main>
      <section className="relative h-[600px] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg')`,
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="container mx-auto px-4 relative text-white">
          <div className="max-w-2xl">
            <img
              src="https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg"
              alt="Makerspace YK Logo"
              className="w-32 h-32 mb-6"
            />
            <h1 className="text-5xl font-bold mb-4">Makerspace YK</h1>
            <p className="text-xl mb-8">
              Makerspace YK is a registered non-profit in Yellowknife, Northwest Territories. We build community with
              hands-on learning opportunities, access to shared space/tools, and skills-building programs.
            </p>
            <Button size="lg" className="bg-yellow-400 hover:bg-yellow-500 text-black">
              Browse Memberships
            </Button>
          </div>
        </div>
      </section>

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
    </main>
  )
}
