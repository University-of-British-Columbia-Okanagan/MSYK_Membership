const GetInvolved = () => {
    return (
      <section className="py-16 bg-gray-700 text-white">
        <div className="container mx-auto px-4">
          {/* Section Title */}
          <h2 className="text-4xl font-bold text-center mb-12">Get Involved</h2>
  
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Rent Our Space */}
            <div className="bg-white text-gray-800 rounded-lg shadow-lg p-8 border-4 border-indigo-400">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <svg
                  className="h-16 w-16 text-indigo-400 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z" />
                </svg>
                {/* Title & Text */}
                <h3 className="text-2xl font-bold mb-4">Rent our space!</h3>
                <p className="text-lg mb-6">
                  Individuals and organizations can book the Artspace for
                  community events, workshops, exhibitions, and more!
                </p>
                {/* Button */}
                <button className="bg-indigo-400 text-white px-6 py-3 rounded-lg hover:bg-indigo-500">
                  Book Now
                </button>
              </div>
            </div>
  
            {/* Volunteer */}
            <div className="bg-white text-gray-800 rounded-lg shadow-lg p-8 border-4 border-orange-400">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <svg
                  className="h-16 w-16 text-orange-400 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z" />
                </svg>
                {/* Title & Text */}
                <h3 className="text-2xl font-bold mb-4">Volunteer</h3>
                <p className="text-lg mb-6">
                  Join our volunteer roster to get more involved with our work!
                </p>
                {/* Button */}
                <button className="bg-orange-400 text-white px-6 py-3 rounded-lg hover:bg-orange-500">
                  Apply Now
                </button>
              </div>
            </div>
  
            {/* Sponsorship */}
            <div className="bg-white text-gray-800 rounded-lg shadow-lg p-8 border-4 border-yellow-400">
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <svg
                  className="h-16 w-16 text-yellow-400 mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z" />
                </svg>
                {/* Title & Text */}
                <h3 className="text-2xl font-bold mb-4">Sponsorship</h3>
                <p className="text-lg mb-6">
                  Help further your impact in the community by supporting our
                  programming and events through sponsorship.
                </p>
                {/* Button */}
                <button className="bg-yellow-400 text-white px-6 py-3 rounded-lg hover:bg-yellow-500">
                  Let's Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };
  
  export default GetInvolved;
  