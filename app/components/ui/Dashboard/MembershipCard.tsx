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
  membershipStatus?: "active" | "cancelled" | "inactive";
  userRecord?: {
    id: number;
    roleLevel: number;
    allowLevel4: boolean;
  } | null;
  hasActiveSubscription?: boolean;
  hasCancelledSubscription?: boolean;
  highestActivePrice?: number;
  highestCanceledPrice?: number;
  nextPaymentDate?: Date;
  membershipRecordId?: number;
}

export default function MembershipCard({
  planId,
  title,
  description,
  price,
  feature,
  isAdmin,
  isSubscribed = false,
  membershipStatus,
  userRecord,
  hasCancelledSubscription = false,
  hasActiveSubscription = false,
  highestActivePrice = 0,
  highestCanceledPrice = 0,
  nextPaymentDate,
  membershipRecordId,
}: MembershipCardProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Handler for membership "Select" or "Resubscribe"
  const handleSelect = () => {
    navigate(`/dashboard/payment/${planId}`);
  };

  // By default, the user can select a membership plan
  let canSelect = true; // CHANGE: we will override this if the user doesn't meet plan-specific requirements
  let reason = ""; // CHANGE: store the reason the button is disabled

  // CHANGE: Additional check for planId = 2 (level 4 membership).
  // Must have:
  //   1) A valid user record
  //   2) roleLevel >= 3 (they've completed orientation and are effectively "level 3")
  //   3) allowLevel4 = true (admin permission)
  //   4) hasActiveSubscription = true (they already have an active membership)
  if (planId === 2) {
    if (
      !userRecord ||
      userRecord.roleLevel < 3 ||
      userRecord.allowLevel4 !== true ||
      !hasActiveSubscription
    ) {
      canSelect = false;
      reason =
        "You must have an active, membership, completed an orientation, and admin permission to select this membership.";
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
        Show different UI depending on membership status:
          1) cancelled -> "You have cancelled this membership" + Resubscribe button
          2) active -> "You are already subscribed" + Cancel button
          3) otherwise -> the "subscribe" or "upgrade/change" button
      */}
      {membershipStatus === "cancelled" ? (
        // <div className="mt-4">
        //   <p className="text-orange-600 font-semibold mb-2">
        //     You have cancelled this membership
        //   </p>
        //   {/*
        //     NEW: Instead of navigating to a payment route,
        //     use a button that triggers a fetch call to the resubscribe endpoint.
        //   */}
        //   <Button
        //     onClick={async () => {
        //       try {
        //         const response = await fetch("/dashboard/payment/resubscribe", {
        //           method: "POST",
        //           headers: { "Content-Type": "application/json" },
        //           // Pass required data as JSON:
        //           body: JSON.stringify({
        //             currentMembershipId: membershipRecordId, // use the passed membership record id
        //             membershipPlanId: planId,
        //             userId: userRecord?.id,
        //           }),
        //         });
        //         const resData = await response.json();
        //         if (resData.success) {
        //           // On success, redirect to the payment success page with resubscribe query
        //           navigate("/dashboard/payment/success?resubscribe=true");
        //         } else {
        //           console.error("Resubscription error:", resData.error);
        //         }
        //       } catch (error) {
        //         console.error("Resubscription fetch error:", error);
        //       }
        //     }}
        //     className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
        //   >
        //     Resubscribe
        //   </Button>
        // </div>
        <div className="mt-4">
          <p className="text-orange-600 font-semibold mb-2">
            You have cancelled this membership
          </p>
          <Button
            // CHANGE: Navigate to the payment page with query params for resubscription.
            onClick={() => {
              // Pass along the membershipRecordId if available (make sure you pass this prop from your loader)
              navigate(
                `/dashboard/payment/${planId}?resubscribe=true${
                  membershipRecordId
                    ? `&membershipRecordId=${membershipRecordId}`
                    : ""
                }`
              );
            }}
            className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition"
          >
            Resubscribe
          </Button>
        </div>
      ) : membershipStatus === "active" ? (
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
                  { planId: String(planId), action: "cancelMembership" },
                  { method: "post" }
                )
              }
              buttonLabel="Cancel Membership"
              buttonClassName="bg-red-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-red-600 transition"
            />
          </fetcher.Form>
        </div>
      ) : (
        // Non-subscribed branch: membershipStatus is "inactive" or no record
        <div className="mt-4">
          {(() => {
  let buttonLabel = "Subscribe";
  let disabled = false;
  let tooltipText = "";

  // If user cannot select due to plan-specific requirements, disable the button.
  if (!canSelect) {
    disabled = true;
    tooltipText = reason;
  }

  // NEW: Determine the button label based on the membership state.
  if (!disabled) {
    // If membershipStatus is "inactive" and a nextPaymentDate exists,
    // it indicates a pending (cancelled/ending) membership.
    if (membershipStatus === "inactive" && nextPaymentDate) {
      if (new Date(nextPaymentDate) > new Date()) {
        // The next payment date is in the future so disable the button.
        disabled = true;
        // If an active subscription exists, compare with highestActivePrice;
        // otherwise, if there's a cancelled membership, compare with highestCanceledPrice.
        if (hasActiveSubscription) {
          buttonLabel = price > highestActivePrice ? "Upgrade" : "Change";
        } else if (hasCancelledSubscription) {
          buttonLabel = price > highestCanceledPrice ? "Upgrade" : "Change";
        } else {
          buttonLabel = "Subscribe";
        }
        tooltipText =
          "You can change only after your old membership billing cycle ends.";
      } else {
        // If the next payment date has passed, allow selection.
        if (hasActiveSubscription) {
          buttonLabel = price > highestActivePrice ? "Upgrade" : "Change";
        } else if (hasCancelledSubscription) {
          buttonLabel = price > highestCanceledPrice ? "Upgrade" : "Change";
        } else {
          buttonLabel = "Subscribe";
        }
      }
    } else if (hasActiveSubscription) {
      // If user has an active subscription, compare the new plan's price
      buttonLabel = highestActivePrice > price ? "Change" : "Upgrade";
    } else if (hasCancelledSubscription) {
      // If user has a cancelled membership, use that price for comparison.
      buttonLabel = highestCanceledPrice > price ? "Change" : "Upgrade";
      disabled = true;
      tooltipText =
        "You cancelled your previous membership. Please resubscribe first before changing plans.";
    } else {
      // Default case: no subscription at all.
      buttonLabel = "Subscribe";
    }
  }

  // Render a disabled button with tooltip if needed.
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
    // Otherwise, allow the user to click the button.
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
                    {
                      planId: String(planId),
                      action: "delete",
                      confirmation: "confirmed",
                    },
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
