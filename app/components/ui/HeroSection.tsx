import React from "react";

interface HeroSectionProps {
  title: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({ title }) => {
  return (
    <section
      className="relative h-[300px] flex items-center justify-center bg-cover bg-center text-white text-5xl font-bold"
      style={{
        backgroundImage:
          "url('public/images/herosectionbackground.avif')",
      }} // Update with actual image URL
    >
      {title}
    </section>
  );
};

export default HeroSection;
