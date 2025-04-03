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
  membershipStatus?: "active" | "cancelled";
  userRecord?: {
    id: number;
    roleLevel: number;
    allowLevel4: boolean;
  } | null;
  hasActiveSubscription?: boolean;
  hasCancelledSubscription?: boolean;
  highestActivePrice?: number;
  highestCanceledPrice?: number;
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
  hasCancelledSubscription = false,
  hasActiveSubscription = false, 
  highestActivePrice = 0,
  highestCanceledPrice = 0,
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

      {membershipStatus === "cancelled" ? (
        <div className="mt-4">
          <p className="text-orange-600 font-semibold mb-2">
            You have cancelled this membership
          </p>
          <Button
            onClick={handleSelect}
            className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
          >
            Resubscribe
          </Button>
        </div>
      ) : isSubscribed ? (
        <div className="mt-4">
          <p className="text-green-600 font-semibold mb-2">
            You are already subscribed
          </p>
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
        // NEW: For non-subscribed plans, handle the "Change"/"Upgrade"/"Select" logic
        <div className="mt-4">
          {(() => {
            let buttonLabel = "Subscribe";
            let disabled = false;
            let tooltipText = "";

            // 1) If planId = 2 and user doesn't meet role/permission, disable
            if (planId === 2 && !canSelect) {
              disabled = true;
              buttonLabel = "Subscribe";
              tooltipText = reason;
            }
            // 2) If the user has any active membership
            else if (hasActiveSubscription) {
              // If the user’s highest active membership is more expensive
              if (highestActivePrice > price) {
                buttonLabel = "Change"; // cheaper plan => "Change"
              } else {
                buttonLabel = "Upgrade"; // more expensive plan => "Upgrade"
              }
            }
            // 3) If the user has NO active membership, but they had some membership before
            else if (hasCancelledSubscription) {
              // If the user's highest canceled membership is more expensive than this plan
              if (highestCanceledPrice > price) {
                buttonLabel = "Change"; // show "Change"
              } else {
                buttonLabel = "Upgrade"; // otherwise "Upgrade"
              }
              // Disabled because they canceled
              disabled = true;
              tooltipText =
                "You cancelled your previous membership. Resubscribe first before changing plans.";
            }
            // 4) Otherwise, user never had a membership => normal "Select" (enabled)
            else {
              buttonLabel = "Subscribe";
              disabled = false;
            }

            // Finally, render the button with optional tooltip if disabled
            if (disabled) {
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          disabled
                          className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md cursor-not-allowed"
                        >
                          {buttonLabel}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            } else {
              return (
                <Button
                  onClick={handleSelect}
                  className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
                >
                  {buttonLabel}
                </Button>
              );
            }
          })()}
        </div>
      )}

      <ul className="text-left text-gray-700 mt-6 space-y-2">
        {feature.map((f, i) => (
          <li key={i} className="flex items-center">
            <span className="text-yellow-500 mr-2">→</span> {f}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <fetcher.Form method="post" className="mt-6">
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="confirmationDelete" value="pending" />
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
