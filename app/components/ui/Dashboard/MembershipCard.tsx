import { useFetcher } from "react-router";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmButton } from "../ConfirmButton";

interface MembershipCardProps {
  title: string;
  description: string;
  price: number;
  feature: string[];
  isAdmin: boolean;
  planId: number;
  isSubscribed?: boolean; // new prop
}

export default function MembershipCard({
  title,
  description,
  price,
  feature,
  isAdmin,
  planId,
  isSubscribed = false,
}: MembershipCardProps) {
  const fetcher = useFetcher();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  // Handler for membership "Select"
  const handleSelect = () => {
    // If not subscribed, go to the payment route for this membership plan
    navigate(`/dashboard/payment/${planId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden text-center p-8">
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-600 mt-2">{description}</p>
      <div className="mt-4">
        <span className="text-4xl font-bold text-gray-900">${price}</span>
        <span className="text-gray-600 text-sm"> /month</span>
      </div>

      {/* If user is already subscribed, show a message + Cancel Membership button */}
      {isSubscribed ? (
        <div className="mt-4">
          <p className="text-green-600 font-semibold mb-2">
            You are already a member
          </p>
          <ConfirmButton
            confirmTitle="Cancel Membership?"
            confirmDescription="Are you sure you want to cancel your membership subscription? This action cannot be undone."
            onConfirm={() =>
              fetcher.submit({ planId, action: "cancelMembership" }, { method: "post" })
            }
            buttonLabel="Cancel Membership"
            buttonClassName="bg-red-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-red-600 transition"
          />
        </div>
      ) : (
        <button
          onClick={handleSelect}
          className="mt-4 bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
        >
          Select
        </button>
      )}

      <ul className="text-left text-gray-700 mt-6 space-y-2">
        {feature.map((f, i) => (
          <li key={i} className="flex items-center">
            <span className="text-yellow-500 mr-2">→</span> {f}
          </li>
        ))}
      </ul>

      {/* Render Edit and Delete Buttons Conditionally (admin) */}
      {isAdmin && (
        <fetcher.Form method="post" className="mt-6">
          <input type="hidden" name="planId" value={planId} />
          <input
            type="hidden"
            name="confirmationDelete"
            value={confirmDelete ? "confirmed" : "pending"}
          />
          <div className="flex justify-center space-x-4">
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
