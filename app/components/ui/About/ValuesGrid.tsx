export default function ValuesGrid() {
    return (
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-yellow-500 text-white rounded-lg">Empowering</div>
            <div className="p-6 bg-indigo-500 text-white rounded-lg">Innovative</div>
            <div className="p-6 bg-orange-500 text-white rounded-lg">Inclusive</div>
            <div className="p-6 bg-gray-700 text-white rounded-lg">Community-Driven</div>
          </div>
        </div>
      </section>
    );
  }