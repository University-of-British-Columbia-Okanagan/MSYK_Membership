import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetcher } from "react-router";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";
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
  membershipStatus?: "active" | "cancelled" | "inactive";
  userRecord?: {
    id: number;
    roleLevel: number;
    allowLevel4: boolean;
  } | null;
  hasActiveSubscription?: boolean;
  hasCancelledSubscription?: boolean;
  highestActivePrice?: number;
  nextPaymentDate?: Date;
  membershipRecordId?: number;
  needAdminPermission?: boolean;
  roleUser?: {
    roleId: number;
    roleName: string;
    userId: number;
  } | null;
  isCurrentlyActivePlan?: boolean;
}

export default function MembershipCard({
  planId,
  title,
  description,
  price,
  feature,
  isAdmin,
  membershipStatus,
  userRecord,
  hasCancelledSubscription = false,
  hasActiveSubscription = false,
  highestActivePrice = 0,
  nextPaymentDate,
  membershipRecordId,
  needAdminPermission,
  roleUser,
  isCurrentlyActivePlan = false,
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
      case "Current Plan":
        return CheckCircle;
      default:
        return null;
    }
  }

  // Handler for membership "Select" or "Resubscribe"
  const handleSelect = () => {
    // For resubscriptions, go directly to payment
    // For new subscriptions and upgrades/downgrades, go to agreement signing first
    const isResubscribeAction =
      membershipStatus === "cancelled" && hasCancelledSubscription;

    if (isResubscribeAction) {
      navigate(
        `/dashboard/payment/${planId}?resubscribe=true${
          membershipRecordId ? `&membershipRecordId=${membershipRecordId}` : ""
        }`
      );
    } else {
      navigate(`/dashboard/memberships/${planId}`);
    }
  };

  // By default, the user can select a membership plan
  let canSelect = true; // We will override this if the user doesn't meet plan-specific requirements
  let reason = ""; // Store the reason the button is disabled

  // Guest user authentication
  const isGuest = !roleUser || !roleUser.userId;
  if (isGuest) {
    canSelect = false;
    reason = "You need an account to purchase a membership.";
  }

  // Additional check for plan.needAdminPermission (level 4 membership).
  // Must have:
  //   1) A valid user record
  //   2) roleLevel >= 3 (they've completed orientation and are effectively "level 3")
  //   3) allowLevel4 = true (admin permission)
  //   4) hasActiveSubscription = true (they already have an active membership)
  if (needAdminPermission) {
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
    <div className="bg-white rounded-lg shadow-md border border-indigo-400 p-6 w-96 text-center flex-none">
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
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-full shadow-md transition flex items-center justify-center"
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
            // 1) Plan‑4 gating OR guest user: disabled Subscribe with reason
            if (!canSelect) {
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          disabled
                          className="bg-gray-400 text-white px-6 py-2 rounded-full shadow-md cursor-not-allowed flex items-center justify-center"
                          onClick={
                            isGuest
                              ? () => {
                                  const currentUrl =
                                    window.location.pathname +
                                    window.location.search;
                                  window.location.href = `/login?redirect=${encodeURIComponent(
                                    currentUrl
                                  )}`;
                                }
                              : undefined
                          }
                        >
                          <PlusCircle className="w-5 h-5 mr-2" />
                          Subscribe
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      className={
                        isGuest
                          ? "bg-blue-100 text-blue-800 border border-blue-300 p-2 max-w-xs"
                          : ""
                      }
                    >
                      {isGuest ? (
                        <div className="text-center">
                          <p className="mb-2">{reason}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const currentUrl =
                                  window.location.pathname +
                                  window.location.search;
                                window.location.href = `/login?redirect=${encodeURIComponent(
                                  currentUrl
                                )}`;
                              }}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                            >
                              Sign In
                            </button>
                            <button
                              onClick={() => {
                                const currentUrl =
                                  window.location.pathname +
                                  window.location.search;
                                window.location.href = `/register?redirect=${encodeURIComponent(
                                  currentUrl
                                )}`;
                              }}
                              className="bg-white hover:bg-blue-50 text-blue-500 border border-blue-500 px-3 py-1 rounded text-sm"
                            >
                              Create Account
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p>{reason}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            const now = new Date();

            // 2) Mid‑billing‑cycle: status inactive but nextPaymentDate in future → disable change
            if (
              membershipStatus === "inactive" &&
              nextPaymentDate != null &&
              new Date(nextPaymentDate) > now
            ) {
              // Choose Upgrade or Downgrade if you have an active sub; otherwise Subscribe
              const buttonLabel = hasActiveSubscription
                ? price > highestActivePrice
                  ? "Upgrade"
                  : "Downgrade"
                : "Subscribe";
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
                      <p>
                        You can change only after your old membership billing
                        cycle ends.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            // 3) Normal upgrade/downgrade
            if (hasActiveSubscription) {
              // Check if this plan is currently active (not just compare prices)

              const buttonLabel = isCurrentlyActivePlan
                ? "Current Plan"
                : price > highestActivePrice
                  ? "Upgrade"
                  : "Downgrade";
              const Icon = getIconForLabel(buttonLabel);
              return (
                <Button
                  onClick={
                    buttonLabel === "Current Plan" ? undefined : handleSelect
                  }
                  disabled={buttonLabel === "Current Plan"}
                  className={`px-6 py-2 rounded-full shadow-md transition flex items-center justify-center ${
                    buttonLabel === "Current Plan"
                      ? "bg-green-500 text-white cursor-default"
                      : "bg-indigo-500 text-white hover:bg-indigo-600"
                  }`}
                >
                  {Icon && <Icon className="w-5 h-5 mr-2" />}
                  {buttonLabel}
                </Button>
              );
            }

            // 4) Fully cancelled (no active), must resubscribe first
            if (!hasActiveSubscription && hasCancelledSubscription) {
              return (
                <Button
                  onClick={handleSelect}
                  className="bg-indigo-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-indigo-600 transition flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Resubscribe
                </Button>
              );
            }

            // 5) Fallback: brand‑new Subscribe
            return (
              <Button
                onClick={handleSelect}
                className="bg-indigo-500 text-white px-6 py-2 rounded-full shadow-md hover:bg-indigo-600 transition flex items-center justify-center"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Subscribe
              </Button>
            );
          })()}
        </div>
      )}

      <ul className="text-left text-gray-700 mt-6 space-y-2">
        {feature.map((f, i) => (
          <li key={i} className="flex items-center">
            <span className="text-indigo-500 mr-2">→</span> {f}
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
              className="bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition flex items-center space-x-2"
            >
              <Edit className="w-5 h-5" />
              <span>Edit</span>
            </button>

            <button
              type="submit"
              name="action"
              value="delete"
              className="bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition flex items-center space-x-2"
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
