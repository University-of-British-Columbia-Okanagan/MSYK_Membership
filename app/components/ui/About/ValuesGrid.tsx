import React from "react";

const values = [
  {
    title: "Empowering",
    text: "Giving people the confidence, skills, tools and space they need to reach their potential.",
    bgColor: "bg-yellow-400",
  },
  {
    title: "Innovative",
    text: "Fostering an environment that encourages people to look at challenges and find solutions in new and different ways.",
    bgColor: "bg-indigo-500",
  },
  {
    title: "Inclusive",
    text: "Committed to removing barriers to access and opening doors for participation to all members of the community.",
    bgColor: "bg-orange-500",
  },
  {
    title: "Community-Driven",
    text: "Listening to and maintaining strong relationships with the membership and meeting the needs of the community.",
    bgColor: "bg-gray-700",
  },
];

const ValuesGrid = () => {
  return (
    <section className="max-w-4xl mx-auto my-12">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {/* Our Values Block */}
        <div className="bg-gray-800 text-white p-6 flex items-center justify-center text-2xl font-bold col-span-2 md:col-span-1">
          Our Values
        </div>

        {/* Value Cards */}
        {values.map((value, index) => (
          <div key={index} className={`${value.bgColor} p-6 text-white`}>
            <h3 className="text-lg font-bold">{value.title}</h3>
            <p className="mt-2 text-sm">{value.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ValuesGrid;
