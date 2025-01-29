import HeroSection from "@/components/ui/MakertoMarket/HeroSection";
import Footer from "@/components/ui/Home/Footer";
import MakerMarketSection from "@/components/ui/MakertoMarket/MakerMarketSection";
const courses = [
  {
    title: "Intro to Product Photography",
    description: "Tips and tricks to take great product and print photos!",
    price: "$40",
    image: "/images/product-photography.jpg",
    ended: true,
  },
  {
    title: "Graphic Design Basics",
    description:
      "Learn basic graphic design concepts and what software you can use.",
    price: "$40",
    image: "/images/graphic-design.jpg",
    ended: false,
  },
  {
    title: "2D Digital Production",
    description:
      "From laser cutters and Cricut, learn about 2D digital production techniques.",
    price: "$40",
    image: "/images/2d-digital-production.jpg",
    ended: false,
  },
  {
    title: "3D Digital Production",
    description:
      "Learn how 3D printing and CNC machines can be used for business.",
    price: "$40",
    image: "/images/3d-digital-production.jpg",
    ended: false,
  },
  {
    title: "Techniques for Textiles",
    description:
      "From screenprinting to embroidery, vinyl, and invisible inks!",
    price: "$40",
    image: "/images/textiles.jpg",
    ended: false,
  },
  {
    title: "Intro to E-Commerce with Prosper NWT",
    description: "Dates to be confirmed",
    price: "TBD",
    image: "/images/ecommerce.jpg",
    ended: false,
  },
];

export default function MakerToMarket() {
  return (
    <main>
      {/* Hero Section */}
      <HeroSection
        title="Maker to Market Program"
        backgroundImage="public/images/makertomarketbg.avif"
      />

      {/* Program Intro */}
      <section className="container mx-auto text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">
          Maker to Market Program
        </h2>
        <p className="text-lg text-gray-700 mt-4 px-4 md:px-20">
          <strong className="text-orange-600">
            Complete all courses in Makerspace YK's Maker to Market Program and
            get a 1-month Maker membership PLUS 50% off orientations for the
            equipment introduced in the program.
          </strong>
        </p>
        <p className="mt-4 text-gray-600">
          Don’t miss out on this chance to boost your business with the tools
          and skills you need!
        </p>
      </section>

      {/* Courses Grid */}
      <section className="container mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {courses.map((course, index) => (
          <div key={index} className="border rounded-lg shadow-md p-4 bg-white">
            <img
              src={course.image}
              alt={course.title}
              className="w-full h-40 object-cover rounded-md"
            />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {course.title}
            </h3>
            <p className="text-sm text-gray-600">{course.description}</p>
            <p className="mt-2 text-lg font-bold text-orange-500">
              {course.price}
            </p>
            {course.ended ? (
              <button className="mt-2 w-full bg-gray-300 text-gray-600 font-semibold py-2 rounded-md">
                Ended
              </button>
            ) : (
              <button className="mt-2 w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 rounded-md">
                Book Now
              </button>
            )}
          </div>
        ))}
      </section>
      <section>
        <MakerMarketSection />
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
