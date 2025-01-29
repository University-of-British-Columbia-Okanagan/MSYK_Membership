import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative h-[600px] flex items-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        // style={{
        //   backgroundImage: `url('https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg')`,
        // }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="container mx-auto px-4 relative text-white">
        <div className="max-w-2xl">
          <img
            src="public/images/Makerspace Stamp Logo White.avif"
            alt="Makerspace YK Logo"
            className="w-32 h-32 mb-6"
          />
          <h1 className="text-5xl font-bold mb-4">Makerspace YK</h1>
          <p className="text-xl mb-8">
            Makerspace YK is a registered non-profit in Yellowknife, Northwest
            Territories. We build community with hands-on learning opportunities,
            access to shared space/tools, and skills-building programs.
          </p>
          <Button size="lg" className="bg-yellow-400 hover:bg-yellow-500 text-black">
            Browse Memberships
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
