import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetcher } from "react-router";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface MembershipCardProps {
  planId: number;
  title: string;
  description: string;
  price: number;
  feature: string[];
  isAdmin: boolean;
  isSubscribed?: boolean;
  /**
   * New optional prop to differentiate active vs. cancelled status.
   * If 'active', it shows the "You are already subscribed" block.
   * If 'cancelled', it shows the "You have cancelled this membership" block.
   */
  membershipStatus?: "active" | "cancelled";
  userRecord?: {
    id: number;
    roleLevel: number;
    allowLevel4: boolean;
  } | null;
}

export default function MembershipCard({
  planId,
  title,
  description,
  price,
  feature,
  isAdmin,
  isSubscribed = false,
  membershipStatus, // <--- new prop
  userRecord,
}: MembershipCardProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Handler for membership "Select" or "Resubscribe"
  const handleSelect = () => {
    navigate(`/dashboard/payment/${planId}`);
  };

  // By default, the user can select unless restricted by plan #2 logic
  let canSelect = true;
  let reason = "";

  // If planId = 2, the user must be roleLevel=3 and allowLevel4=true
  if (planId === 2 && membershipStatus !== "cancelled") {
    if (
      !userRecord ||
      userRecord.roleLevel !== 3 ||
      userRecord.allowLevel4 !== true
    ) {
      canSelect = false;
      reason =
        "You must have a previous subscription, a completed orientation, and admin permission to select this membership.";
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden text-center p-8">
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-600 mt-2">{description}</p>
      <div className="mt-4">
        <span className="text-4xl font-bold text-gray-900">${price}</span>
        <span className="text-gray-600 text-sm"> /month</span>
      </div>

      {/* 
        If membershipStatus is "cancelled", show a "You have cancelled..." message 
        and allow the user to resubscribe. 
        Else if isSubscribed, show the existing "You are already subscribed" + cancel button. 
        Otherwise, show the normal "Select" button.
      */}
      {membershipStatus === "cancelled" ? (
        <div className="mt-4">
          <p className="text-orange-600 font-semibold mb-2">
            You have cancelled this membership
          </p>
          {canSelect ? (
            <Button
              onClick={handleSelect}
              className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
            >
              Resubscribe
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      disabled
                      className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md cursor-not-allowed"
                    >
                      Resubscribe
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{reason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ) : isSubscribed ? (
        <div className="mt-4">
          <p className="text-green-600 font-semibold mb-2">
            You are already subscribed
          </p>
          {/* Cancel button with confirmation */}
          <fetcher.Form method="post">
            <input type="hidden" name="planId" value={planId} />
            <ConfirmButton
              confirmTitle="Cancel Membership?"
              confirmDescription="Are you sure you want to cancel your membership subscription?"
              onConfirm={() =>
                fetcher.submit(
                  { planId, action: "cancelMembership" },
                  { method: "post" }
                )
              }
              buttonLabel="Cancel Membership"
              buttonClassName="bg-red-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-red-600 transition"
            />
          </fetcher.Form>
        </div>
      ) : (
        <div className="mt-4">
          {canSelect ? (
            <Button
              onClick={handleSelect}
              className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
            >
              Select
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      disabled
                      className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md cursor-not-allowed"
                    >
                      Select
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{reason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      <ul className="text-left text-gray-700 mt-6 space-y-2">
        {feature.map((f, i) => (
          <li key={i} className="flex items-center">
            <span className="text-yellow-500 mr-2">→</span> {f}
          </li>
        ))}
      </ul>

      {/* Admin Edit/Delete Buttons */}
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
