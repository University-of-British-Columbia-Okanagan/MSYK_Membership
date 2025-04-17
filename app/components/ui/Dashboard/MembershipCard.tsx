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
import {
  RefreshCw,
  XCircle,
  CheckCircle,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash,
} from "lucide-react";

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

  function getIconForLabel(label: string) {
    switch (label) {
      case "Subscribe":
        return PlusCircle;
      case "Resubscribe":
        return RefreshCw;
      case "Upgrade":
        return ArrowUp;
      case "Downgrade":
        return ArrowDown;
      default:
        return null;
    }
  }

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
        "You must have an active membership, completed an orientation, and admin permission to select this membership.";
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-yellow-400 p-6 w-full max-w-sm mx-auto text-center">
      {membershipStatus === "active" && (
        <div className="mt-2 mb-4 flex justify-center">
          <fetcher.Form method="post" className="w-full flex justify-center">
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
              buttonClassName="bg-red-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-red-600 transition"
              buttonLabel={
                <>
                  <XCircle className="w-5 h-5 mr-2" />
                  Cancel Membership
                </>
              }
            />
          </fetcher.Form>
        </div>
      )}

      {membershipStatus === "cancelled" && (
        <div className="mt-2 mb-4 flex justify-center">
          <Button
            onClick={() => {
              navigate(
                `/dashboard/payment/${planId}?resubscribe=true${
                  membershipRecordId
                    ? `&membershipRecordId=${membershipRecordId}`
                    : ""
                }`
              );
            }}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-full shadow-md transition flex items-center justify-center"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Resubscribe
          </Button>
        </div>
      )}

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
          3) otherwise -> the "subscribe" or "upgrade/downgrade" button
      */}
      {membershipStatus === "cancelled" ? (
        <div className="mt-4">
          <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-lg border border-amber-300 mb-3">
            <p className="font-medium text-center">
              You have cancelled this membership
            </p>
          </div>
        </div>
      ) : membershipStatus === "active" ? (
        <div className="mt-4 flex items-center justify-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg border border-green-300">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Currently Subscribed</span>
        </div>
      ) : (
        // Non-subscribed branch: membershipStatus is "inactive" or no record
        <div className="mt-4 flex justify-center">
          {(() => {
            // 0) If the plan is restricted (Plan 2) and the user doesn't meet prereqs:
            if (!canSelect) {
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          disabled
                          className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md cursor-not-allowed flex items-center justify-center"
                        >
                          {/* Always show the “plus” icon for a subscribe action */}
                          <PlusCircle className="w-5 h-5 mr-2" />
                          Subscribe
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {/* reason string passed in from parent loader */}
                      <p>{reason}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            // 1) Default to “Subscribe”
            let buttonLabel = "Subscribe";
            let disabled = false;
            let tooltipText = "";

            // 2) Mid‑billing‑cycle of an old membership?
            if (membershipStatus === "inactive" && nextPaymentDate) {
              const cycleNotEnded = new Date(nextPaymentDate) > new Date();
              if (cycleNotEnded) {
                disabled = true;
                tooltipText =
                  "You can change only after your old membership billing cycle ends.";
                // a) If they've already cancelled another plan, keep it “Subscribe”
                if (hasCancelledSubscription) {
                  buttonLabel = "Subscribe";
                }
                // b) Otherwise show upgrade/downgrade
                else if (hasActiveSubscription) {
                  buttonLabel =
                    price > highestActivePrice ? "Upgrade" : "Downgrade";
                }
              }
            }
            // 3) Simple upgrade/downgrade when not mid‑cycle
            else if (hasActiveSubscription) {
              buttonLabel =
                price > highestActivePrice ? "Upgrade" : "Downgrade";
            }
            // 4) Fully cancelled (no active), must resubscribe first
            else if (!hasActiveSubscription && hasCancelledSubscription) {
              buttonLabel = "Resubscribe";
              disabled = true;
              tooltipText =
                "You cancelled your previous membership. Please resubscribe first before switching plans.";
            }

            // 5) Render disabled + tooltip
            if (disabled) {
              const Icon = getIconForLabel(buttonLabel);
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          disabled
                          className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md cursor-not-allowed flex items-center justify-center"
                        >
                          {Icon && <Icon className="w-5 h-5 mr-2" />}
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
            }

            // 6) Otherwise render the enabled action button
            const Icon = getIconForLabel(buttonLabel);
            return (
              <Button
                onClick={handleSelect}
                className="bg-yellow-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-yellow-600 transition flex items-center justify-center"
              >
                {Icon && <Icon className="w-5 h-5 mr-2" />}
                {buttonLabel}
              </Button>
            );
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
              className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition flex items-center space-x-2"
            >
              <Edit className="w-5 h-5" />
              <span>Edit</span>
            </button>

            <button
              type="submit"
              name="action"
              value="delete"
              className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition flex items-center space-x-2"
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
              <Trash className="w-5 h-5" />
              <span>Delete</span>
            </button>
          </div>
        </fetcher.Form>
      )}
    </div>
  );
}
