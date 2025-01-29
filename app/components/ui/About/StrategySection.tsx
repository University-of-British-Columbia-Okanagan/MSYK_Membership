export default function StrategySection() {
    return (
      <section className="py-16">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold mb-6">Our Strategy</h2>
          <p className="text-lg mb-6">
            Our mandate is to drive sustainable economic diversification and community self-reliance through sharing and collaboration.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <img src="/public/images/About img1.avif" alt="Community Event" className="rounded-lg shadow-md" />
            <img src="/public/images/About img2.avif" alt = "Skill Workshop" className="rounded-lg shadow-md" />
          </div>
        </div>
      </section>
    );
  }