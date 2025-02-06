export default function MembershipCard({
  title,
  description,
  price,
  feature,
}: {
  title: string;
  description: string;
  price: number;
  feature: string[];
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden text-center p-8">
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-600 mt-2">{description}</p>
      <div className="mt-4">
        <span className="text-4xl font-bold text-gray-900">${price}</span>
        <span className="text-gray-600 text-sm"> /month</span>
      </div>
      <button className="mt-4 bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition">
        Select
      </button>
      <ul className="text-left text-gray-700 mt-6 space-y-2">
        {feature.map((feature, i) => (
          <li key={i} className="flex items-center">
            <span className="text-yellow-500 mr-2">→</span> {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
