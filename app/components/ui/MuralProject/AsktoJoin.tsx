import React from "react";

const applications = [
  {
    title: "Mentor Mural Artist",
    age: "Ages 18+",
    deadline: "Application deadline extended to Oct. 30th",
    details: [
      "Work with mentees to guide the vision for the artwork.",
      "Create a design and work with mentees to produce a 4' x 8' mural.",
      "Teach techniques along the way.",
    ],
    note: "Mural production to begin mid-November",
  },
  {
    title: "Mentee Mural Artist",
    age: "Ages 14+",
    deadline: "Application deadline extended to Oct. 30th",
    details: [
      "Work with a Mentor Mural Artist to contribute ideas for the final artwork.",
      "Learn techniques and practice skills supporting the mentor artist in the production of a 4' x 8' mural.",
    ],
    note: "Mural production to begin mid-November",
  },
  {
    title: "Mentor Digital Artist",
    age: "Ages 18+",
    deadline: "Application deadline extended to Oct. 30th",
    details: [
      "Guide Mentee Digital Artists through the process of creating looping animations to play over the murals within the AR App, Artivive.",
      "Assistance to the Mentor will be provided by an AR Guru. They will be able to answer questions about working with Artivive.",
    ],
    note: "Animation will begin in the new year.",
  },
  {
    title: "Mentee Digital Artist",
    age: "Ages 14+",
    deadline: "Applications close November 14th.",
    details: [
      "Select a mural design and decide how to animate it.",
      "Receive instruction from the Digital Arts Mentor for creating looping animations to play over the murals within the AR App, Artivive.",
    ],
    note: "Animation will begin in the new year.",
  },
];

const ApplyToJoin = () => {
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-orange-600">
          Apply to join as a...
        </h2>
      </div>

      {/* Cards Grid */}
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 mt-8">
        {applications.map((app, index) => (
          <div
            key={index}
            className="border border-gray-300 p-6 rounded-lg shadow-md bg-white"
          >
            <h3 className="text-xl font-bold text-orange-500">{app.title}</h3>
            <p className="text-gray-700">{app.age}</p>
            <p className="text-gray-600 italic mt-2">Paid opportunity</p>
            <p className="font-bold mt-2">{app.deadline}</p>
            <ul className="text-gray-700 mt-4 list-disc list-inside">
              {app.details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
            <p className="text-gray-600 italic mt-4">{app.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ApplyToJoin;
