import React from "react";

const NewsletterSignup = () => {
  return (
    <section className="bg-white py-16">
      <div className="container mx-auto flex justify-center">
        <div className="bg-gray-100 p-6 rounded-lg shadow-lg text-center w-full max-w-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Stay Updated! Subscribe to our newsletter!
          </h3>
          <form className="flex">
            <input
              type="email"
              placeholder="Enter your email here *"
              className="w-full px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none"
            />
            <button
              type="submit"
              className="bg-yellow-500 text-white px-6 py-2 rounded-r-md font-bold hover:bg-yellow-600"
            >
              Sign Up
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSignup;
