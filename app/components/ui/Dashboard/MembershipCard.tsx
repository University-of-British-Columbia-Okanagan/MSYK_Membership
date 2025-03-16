import { useFetcher } from "react-router";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function MembershipCard({
  title,
  description,
  price,
  feature,
  isAdmin,
  planId,
}: {
  title: string;
  description: string;
  price: number;
  feature: string[];
  isAdmin: boolean;
  planId: number;
}) {
  const fetcher = useFetcher();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden text-center p-8">
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-600 mt-2">{description}</p>
      <div className="mt-4">
        <span className="text-4xl font-bold text-gray-900">${price}</span>
        <span className="text-gray-600 text-sm"> /month</span>
      </div>
      <button
        onClick={() => navigate(`/dashboard/payment/${planId}`)}
        className="mt-4 bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
      >
        Select
      </button>
      <ul className="text-left text-gray-700 mt-6 space-y-2">
        {feature.map((feature, i) => (
          <li key={i} className="flex items-center">
            <span className="text-yellow-500 mr-2">→</span> {feature}
          </li>
        ))}
      </ul>
      {/* Render Edit and Delete Buttons Conditionally */}
      {isAdmin && (
        <fetcher.Form method="post">
          <input type="hidden" name="planId" value={planId} />
          <input
            type="hidden"
            name="confirmationDelete"
            value={confirmDelete ? "confirmed" : "pending"}
          />
          <div className="flex justify-center mt-6 space-x-4">
            <button
              type="submit"
              name="action"
              value="edit"
              className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
            >
              Edit
            </button>
            <button
              type="submit"
              name="action"
              value="delete"
              className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this membership plan?"
                  )
                ) {
                  setConfirmDelete(true);
                  fetcher.submit(
                    { planId, action: "delete", confirmation: "confirmed" },
                    { method: "post" }
                  );
                }
              }}
            >
              Delete
            </button>
          </div>
        </fetcher.Form>
      )}
    </div>
  );
}
