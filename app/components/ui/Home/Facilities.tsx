const FacilitiesSection = () => {
    return (
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto flex flex-wrap md:flex-nowrap items-center gap-8">
          {/* Left Side: Text Content */}
          <div className="flex-1 bg-gray-700 text-white p-8 rounded-lg">
            <h2 className="text-4xl font-bold mb-4">Our Facilities</h2>
            <p className="text-lg mb-6">
              We want to create a space where we can host workshops and work on projects,
              fostering a collaborative environment for all.
            </p>
            <p className="text-lg">Join one of our workshops, become a member, or drop in to get making!</p>
          </div>
  
          {/* Right Side: Image */}
          <div className="flex-1">
            <img
              src="https://sjc.microlink.io/3UMVMIwFkaLgGJPRMk1CufTQH3jIGhRTSYX6nADLrgUu0b6wbTgC5__71QWicGqMcM-rWEDf2KwHjj_S0n2ROg.jpeg"
              alt="Our Facilities"
              className="rounded-lg shadow-lg"
            />
          </div>
        </div>
      </section>
    );
  };
  
  export default FacilitiesSection;
  