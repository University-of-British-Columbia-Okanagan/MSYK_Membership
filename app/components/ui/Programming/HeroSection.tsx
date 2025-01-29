import React from "react";

const HeroSection = () => {
  return (
    <section className="relative h-[400px] flex items-center">
      <div className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://sjc.microlink.io/your-hero-image-url.jpeg')` }}>
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="container mx-auto px-4 relative text-white">
        <h1 className="text-5xl font-bold">Programming</h1>
      </div>
    </section>
  );
};

export default HeroSection;