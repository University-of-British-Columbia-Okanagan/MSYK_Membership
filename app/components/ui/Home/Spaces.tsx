const SpacesSection = () => {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shopspace */}
            <div className="bg-yellow-500 text-white p-8 rounded-lg shadow-lg">
              <h3 className="text-3xl font-bold mb-4">Shopspace</h3>
              <p className="text-lg">
                Get hands-on! Come use our fully outfitted woodshop to get
                building. From small-scale to large-scale ideas, we have the tools
                and equipment you need to complete your project.
              </p>
            </div>
  
            {/* Hackspace */}
            <div className="bg-indigo-500 text-white p-8 rounded-lg shadow-lg">
              <h3 className="text-3xl font-bold mb-4">Hackspace</h3>
              <p className="text-lg">
                Making goes digital! Join us to get tech-savvy at Hackspace. Learn
                skills like coding and electronics to use in your own projects,
                collaborations, and more.
              </p>
            </div>
  
            {/* Artspace */}
            <div className="bg-orange-500 text-white p-8 rounded-lg shadow-lg">
              <h3 className="text-3xl font-bold mb-4">Artspace</h3>
              <p className="text-lg">
                Get creative with the community. Artspace hosts events and
                workshops by other artists, makers, and community organizations.
                Join a workshop or even host one yourself!
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  };
  
  export default SpacesSection;
  