import React from "react";

interface HeroSectionProps {
  title: string;
  backgroundImage: string;
  description?: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  backgroundImage,
  description,
}) => {
  return (
    <section
      className="relative h-[300px] md:h-[400px] flex items-center justify-center bg-cover bg-center text-white"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="bg-gray-800 bg-opacity-70 p-6 md:p-8 rounded-md text-center">
        <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-lg">{description}</p>}
      </div>
    </section>
  );
};

export default HeroSection;
