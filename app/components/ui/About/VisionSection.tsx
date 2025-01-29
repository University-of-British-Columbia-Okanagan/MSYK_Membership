export default function VisionSection() {
    return (
      <section className="py-16 container mx-auto">
        <h2 className="text-3xl font-bold mb-6">Our Vision</h2>
        <p className="text-lg mb-6">
          To empower and provide a space for individuals to gain confidence, build practical skills, and grow creatively.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-indigo-500 text-white rounded-lg">Strategic Goal #1: Build Up Individuals</div>
          <div className="p-4 bg-orange-500 text-white rounded-lg">Strategic Goal #2: Build Up the Community</div>
          <div className="p-4 bg-yellow-500 text-white rounded-lg">Strategic Goal #3: Build Up the Organization</div>
        </div>
      </section>
    );
  }