import React from "react";

const visionGoals = [
  {
    title: "Build Up Individuals",
    goal: "Strategic Goal #1:",
    bgColor: "bg-indigo-500",
    icon: "✊", // Replace with an actual SVG if needed
  },
  {
    title: "Build Up the Community",
    goal: "Strategic Goal #2:",
    bgColor: "bg-orange-500",
    icon: "🤝",
  },
  {
    title: "Build Up the Organization",
    goal: "Strategic Goal #3:",
    bgColor: "bg-yellow-400",
    icon: "🏢",
  },
];

const VisionSection = () => {
  return (
    <section className="max-w-6xl mx-auto py-16 px-6 flex flex-col md:flex-row items-center gap-12">
      {/* Vision Text */}
      <div className="md:w-1/2 text-gray-800">
        <h2 className="text-3xl font-bold text-gray-800">Our Vision</h2>
        <p className="mt-4 text-lg text-gray-600 leading-relaxed">
          To empower and provide a space for individuals to gain confidence,
          build practical skills, and grow creatively so that we can build a
          stronger, more resilient, and vibrant community together.
        </p>
      </div>

      {/* Strategic Goals */}
      <div className="md:w-1/2 flex flex-col space-y-6">
        {visionGoals.map((goal, index) => (
          <div
            key={index}
            className={`flex items-center p-4 rounded-lg text-white ${goal.bgColor}`}
          >
            <span className="text-3xl mr-4">{goal.icon}</span>
            <div>
              <p className="text-sm font-semibold">{goal.goal}</p>
              <p className="text-lg font-bold">{goal.title}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default VisionSection;
