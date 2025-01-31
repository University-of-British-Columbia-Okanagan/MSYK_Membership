export default function StrategySection() {
  return (
    <section className="py-16 px-4 bg-gray-100">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-6">Our Strategy</h2>
        <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
          Our mandate is to drive sustainable economic diversification and
          community self-reliance through sharing, collaboration, and
          empowering the already innovative and resilient residents of
          Yellowknife and the Northwest Territories with the tools (in the
          broadest sense of the word) they need to grow their economy and
          community.
        </p>

        {/* Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <img
            src="/public/images/About img1.avif"
            alt="Community Event"
            className="rounded-lg shadow-md w-full h-80 object-cover"
          />
          <img
            src="/public/images/About img2.avif"
            alt="Skill Workshop"
            className="rounded-lg shadow-md w-full h-80 object-cover"
          />
        </div>
      </div>
    </section>
  );
}
