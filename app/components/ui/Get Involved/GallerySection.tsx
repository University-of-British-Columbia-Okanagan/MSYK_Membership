import React from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const images = [
  "https://via.placeholder.com/1200x600?text=Image+1",
  "https://via.placeholder.com/1200x600?text=Image+2",
  "https://via.placeholder.com/1200x600?text=Image+3",
];

const GallerySection = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
  };

  return (
    <section className="bg-gray-700 text-white py-16">
      <div className="container mx-auto px-4 text-center">
        {/* Image Carousel */}
        <div className="max-w-4xl mx-auto">
          <Slider {...settings}>
            {images.map((src, index) => (
              <div key={index}>
                <img
                  src={src}
                  alt={`Gallery ${index + 1}`}
                  className="rounded-lg shadow-lg w-full"
                />
              </div>
            ))}
          </Slider>
        </div>

        {/* Description */}
        <div className="mt-8 max-w-2xl mx-auto">
          <p className="text-lg">
            At Makerspace YK, we believe in building a vibrant, creative
            community where everyone can contribute and benefit. Whether you’re
            interested in becoming a member, volunteering, sharing your skills
            through workshops, or supporting us through sponsorship or
            donations, there are many ways to get involved. Join us and help
            shape a dynamic space for learning, making, and innovation.
          </p>
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
