import { useLoaderData, useNavigate, redirect } from "react-router-dom";
import type { LoaderFunction } from "react-router";
import { Button } from "@/components/ui/button";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  getWorkshopPriceVariation,
  checkWorkshopCapacity,
  checkMultiDayWorkshopCapacity,
} from "../../models/workshop.server";
import {
  getMembershipPlanById,
  getUserActiveMembership,
} from "../../models/membership.server";
import { getUser, getRoleUser } from "~/utils/session.server";
import { useState } from "react";
import { getSavedPaymentMethod, getUserById } from "../../models/user.server";
import QuickCheckout from "~/components/ui/Dashboard/QuickCheckout";
import { getAdminSetting } from "../../models/admin.server";
import { addBusinessMonths, formatBusinessDate } from "~/utils/business-time";
import { isPastRegistrationCutoff } from "~/utils/registration-cutoff";
import {
  BILLING_CYCLE_LABELS,
  getPlanPriceForCycle,
  isBillingCycle,
} from "~/utils/membership-rules";

// Loader: load either workshop data or membership plan data based on route parameters
export const loader: LoaderFunction = async ({ params, request }) => {
  const user = await getUser(request);
  if (!user) {
    if (params.membershipPlanId) {
      throw redirect("/dashboard");
    }
    throw redirect("/dashboard/workshops");
  }

  // Get role user to determine redirect path
  const roleUser = await getRoleUser(request);
  const isAdmin = roleUser?.roleName === "Admin";

  const userRecord = await getUserById(user.id);

  // Determine redirect path based on user role
  const getRedirectPath = () => {
    if (!user) return "/dashboard/workshops";
    if (isAdmin) return "/dashboard/admin";
    return "/dashboard/user";
  };

  const roleRedirectPath = isAdmin ? "/dashboard/admin" : "/dashboard/user";
  const searchParams = new URL(request.url).searchParams;

  const savedPaymentMethod = await getSavedPaymentMethod(user.id);

  // Membership branch
  if (params.membershipPlanId) {
    if (userRecord?.membershipStatus === "revoked") {
      throw redirect("/dashboard/memberships?revoked=1");
    }

    const membershipPlanId = Number(params.membershipPlanId);
    if (isNaN(membershipPlanId))
      throw new Response("Invalid membership plan ID", { status: 400 });

    const membershipPlan = await getMembershipPlanById(membershipPlanId);
    if (!membershipPlan)
      throw new Response("Membership Plan not found", { status: 404 });

    const userActiveMembership = await getUserActiveMembership(user.id);

    if (
      userActiveMembership &&
      userActiveMembership.membershipPlanId === membershipPlanId &&
      userActiveMembership.status === "active"
    ) {
      throw redirect(roleRedirectPath);
    }

    const url = new URL(request.url);
    const billingCycle = url.searchParams.get("billingCycle") || "monthly";
    const autoRenewParam = url.searchParams.get("autoRenew");
    const autoRenew =
      autoRenewParam === null
        ? true
        : autoRenewParam !== "false" && autoRenewParam !== "0";

    // Same price the checkout will charge; a cycle the plan does not offer is refused there too.
    const membershipPrice = getPlanPriceForCycle(membershipPlan, billingCycle);
    if (!isBillingCycle(billingCycle) || membershipPrice == null) {
      const label = isBillingCycle(billingCycle) ? BILLING_CYCLE_LABELS[billingCycle] : "that";
      throw new Response(
        `This plan is not offered with ${label} billing. Please choose another billing cycle.`,
        { status: 400 }
      );
    }

    // Plans requiring admin permission; resubscribing is held to the same rule.
    if (membershipPlan.needAdminPermission) {
      const meetsLevelRequirement = (userRecord?.roleLevel ?? 0) >= 3;
      const hasAdminPermission = userRecord?.allowLevel4 === true;

      if (!meetsLevelRequirement || !hasAdminPermission) {
        throw redirect(roleRedirectPath);
      }
    }

    let upgradeFee = 0;
    let oldMembershipTitle = null;
    let oldMembershipPrice = null;
    let oldMembershipNextPaymentDate = null;
    let isDowngrade = false;
    let changeNotAllowed = false;
    let needsPayment = false;

    // Only compute compensation if the user has an active membership
    if (userActiveMembership) {
      const now = new Date();
      const oldPrice = userActiveMembership.membershipPlan.price;
      const newPrice = membershipPrice;

      const isMonthlyToMonthly =
        (userActiveMembership.billingCycle as string) === "monthly" &&
        (billingCycle as string) === "monthly";

      // Instead of using the original signup date for A, use a date exactly one month before the next payment
      const nextPaymentDate = new Date(userActiveMembership.nextPaymentDate);
      const effectiveStartDate = addBusinessMonths(nextPaymentDate, -1);
      // A is now the time already used in the current billing cycle
      const A = now.getTime() - effectiveStartDate.getTime();
      // B remains the time left until next payment
      const B = nextPaymentDate.getTime() - now.getTime();
      const total = A + B; // This will now be approximately one month

      // Check if this is an upgrade or downgrade
      if (!isMonthlyToMonthly) {
        changeNotAllowed = true;
      } else if (newPrice > oldPrice) {
        upgradeFee = (B / total) * (newPrice - oldPrice);
      } else if (newPrice < oldPrice) {
        isDowngrade = true;
      }

      oldMembershipTitle = userActiveMembership.membershipPlan.title;
      oldMembershipPrice = oldPrice;
      oldMembershipNextPaymentDate = userActiveMembership.nextPaymentDate
        ? new Date(userActiveMembership.nextPaymentDate).toISOString() // Convert to ISO string
        : null;
    }

    let isResubscription = false;

    // Check if this is a resubscription based on query parameter
    if (searchParams.get("resubscribe") === "true") {
      isResubscription = true;
      upgradeFee = 0; // No payment needed for resubscription
    }

    // Also check if user has an active membership that's cancelled for the same plan
    if (
      userActiveMembership &&
      userActiveMembership.status === "cancelled" &&
      membershipPlan.id === userActiveMembership.membershipPlanId
    ) {
      isResubscription = true;
      upgradeFee = 0; // No payment needed for resubscription
    }

    // Extract membershipRecordId from query parameters for resubscription
    const membershipRecordId = searchParams.get("membershipRecordId");

    const gstPercentage = await getAdminSetting("gst_percentage", "5");

    needsPayment =
      !userActiveMembership ||
      (upgradeFee > 0 && !isDowngrade && !changeNotAllowed);

    if (changeNotAllowed) {
      throw redirect(roleRedirectPath);
    }

    return {
      membershipPlan: {
        ...membershipPlan,
        displayPrice: membershipPrice,
      },
      user,
      upgradeFee,
      oldMembershipTitle,
      oldMembershipPrice,
      userActiveMembership,
      oldMembershipNextPaymentDate,
      isDowngrade,
      isResubscription,
      membershipRecordId,
      savedPaymentMethod,
      gstPercentage: parseFloat(gstPercentage),
      billingCycle,
      autoRenew,
      changeNotAllowed,
      needsPayment,
    };
  }

  // Branch for single workshops without variations
  else if (params.workshopId && params.occurrenceId && !params.variationId) {
    const workshopId = Number(params.workshopId);
    const occurrenceId = Number(params.occurrenceId);
    if (isNaN(workshopId) || isNaN(occurrenceId))
      throw new Response("Invalid workshop or occurrence ID", { status: 400 });

    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!workshop || !occurrence)
      throw new Response("Workshop or Occurrence not found", { status: 404 });

    // CHECK: If occurrence is cancelled, redirect user
    if (occurrence.status === "cancelled") {
      throw redirect(getRedirectPath());
    }

    // CHECK: If workshop is full, redirect user
    const capacityCheck = await checkWorkshopCapacity(workshopId, occurrenceId);
    if (!capacityCheck.hasCapacity) {
      throw redirect(getRedirectPath());
    }

    // CHECK: If occurrence is in the past, redirect user
    const now = new Date();
    if (new Date(occurrence.endDate) < now) {
      throw redirect(getRedirectPath());
    }

    if (
      isPastRegistrationCutoff(
        new Date(occurrence.startDate),
        workshop.registrationCutoff
      )
    ) {
      throw redirect(getRedirectPath());
    }

    const gstPercentage = await getAdminSetting("gst_percentage", "5");

    return {
      workshop,
      occurrence,
      user,
      isMultiDayWorkshop: false,
      savedPaymentMethod,
      gstPercentage: parseFloat(gstPercentage),
      selectedVariation: null,
    };
  }

  // Branch for single workshops with price variations
  else if (params.workshopId && params.occurrenceId && params.variationId) {
    const workshopId = Number(params.workshopId);
    const occurrenceId = Number(params.occurrenceId);
    const variationId = Number(params.variationId);

    if (isNaN(workshopId) || isNaN(occurrenceId) || isNaN(variationId))
      throw new Response("Invalid workshop, occurrence, or variation ID", {
        status: 400,
      });

    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);

    if (!workshop || !occurrence)
      throw new Response("Workshop or Occurrence not found", { status: 404 });

    // CHECK: If occurrence is cancelled, redirect user
    if (occurrence.status === "cancelled") {
      throw redirect(getRedirectPath());
    }

    // Get the specific price variation
    const selectedVariation = await getWorkshopPriceVariation(variationId);
    if (!selectedVariation || selectedVariation.workshopId !== workshopId)
      throw new Response("Price variation not found", { status: 404 });

    // CHECK: If workshop is full (including variation capacity), redirect user
    const capacityCheck = await checkWorkshopCapacity(
      workshopId,
      occurrenceId,
      variationId
    );
    if (!capacityCheck.hasCapacity) {
      throw redirect(getRedirectPath());
    }

    // CHECK: If occurrence is in the past, redirect user
    const now = new Date();
    if (new Date(occurrence.endDate) < now) {
      throw redirect(getRedirectPath());
    }

    if (
      isPastRegistrationCutoff(
        new Date(occurrence.startDate),
        workshop.registrationCutoff
      )
    ) {
      throw redirect(getRedirectPath());
    }

    const gstPercentage = await getAdminSetting("gst_percentage", "5");

    return {
      workshop,
      occurrence,
      user,
      isMultiDayWorkshop: false,
      savedPaymentMethod,
      gstPercentage: parseFloat(gstPercentage),
      selectedVariation,
    };
  }

  // Branch for multi-day workshops using connectId
  else if (params.workshopId && params.connectId && !params.variationId) {
    const workshopId = Number(params.workshopId);
    const connectId = Number(params.connectId);
    if (isNaN(workshopId) || isNaN(connectId))
      throw new Response("Invalid workshop or connect ID", { status: 400 });

    const workshop = await getWorkshopById(workshopId);
    const occurrences = await getWorkshopOccurrencesByConnectId(
      workshopId,
      connectId
    );
    if (!workshop || !occurrences || occurrences.length === 0)
      throw new Response("Workshop or Occurrences not found", { status: 404 });

    // CHECK: If ANY occurrence is cancelled, redirect user
    const hasAnyCancelledOccurrence = occurrences.some(
      (occ) => occ.status === "cancelled"
    );
    if (hasAnyCancelledOccurrence) {
      throw redirect(getRedirectPath());
    }

    // CHECK: If workshop is full, redirect user
    const capacityCheck = await checkMultiDayWorkshopCapacity(
      workshopId,
      connectId
    );
    if (!capacityCheck.hasCapacity) {
      throw redirect(getRedirectPath());
    }

    // CHECK: If ANY occurrence is in the past, redirect user
    const now = new Date();
    const hasAnyPastOccurrence = occurrences.some(
      (occ) => new Date(occ.endDate) < now
    );
    if (hasAnyPastOccurrence) {
      throw redirect(getRedirectPath());
    }

    if (
      isPastRegistrationCutoff(
        new Date(occurrences[0].startDate),
        workshop.registrationCutoff
      )
    ) {
      throw redirect(getRedirectPath());
    }

    const gstPercentage = await getAdminSetting("gst_percentage", "5");

    return {
      workshop,
      occurrence: occurrences[0],
      user,
      isMultiDayWorkshop: true,
      savedPaymentMethod,
      gstPercentage: parseFloat(gstPercentage),
      selectedVariation: null,
    };
  }

  // Branch for multi-day workshops with price variations
  else if (params.workshopId && params.connectId && params.variationId) {
    const workshopId = Number(params.workshopId);
    const connectId = Number(params.connectId);
    const variationId = Number(params.variationId);

    if (isNaN(workshopId) || isNaN(connectId) || isNaN(variationId))
      throw new Response("Invalid workshop, connect, or variation ID", {
        status: 400,
      });

    const workshop = await getWorkshopById(workshopId);
    const occurrences = await getWorkshopOccurrencesByConnectId(
      workshopId,
      connectId
    );

    if (!workshop || !occurrences || occurrences.length === 0)
      throw new Response("Workshop or Occurrences not found", { status: 404 });

    // CHECK: If ANY occurrence is cancelled, redirect user
    const hasAnyCancelledOccurrence = occurrences.some(
      (occ) => occ.status === "cancelled"
    );
    if (hasAnyCancelledOccurrence) {
      throw redirect(getRedirectPath());
    }

    // Get the specific price variation
    const selectedVariation = await getWorkshopPriceVariation(variationId);
    if (!selectedVariation || selectedVariation.workshopId !== workshopId)
      throw new Response("Price variation not found", { status: 404 });

    // CHECK: If workshop is full (including variation capacity), redirect user
    const capacityCheck = await checkMultiDayWorkshopCapacity(
      workshopId,
      connectId,
      variationId
    );
    if (!capacityCheck.hasCapacity) {
      throw redirect(getRedirectPath());
    }

    // CHECK: If ANY occurrence is in the past, redirect user
    const now = new Date();
    const hasAnyPastOccurrence = occurrences.some(
      (occ) => new Date(occ.endDate) < now
    );
    if (hasAnyPastOccurrence) {
      throw redirect(getRedirectPath());
    }

    if (
      isPastRegistrationCutoff(
        new Date(occurrences[0].startDate),
        workshop.registrationCutoff
      )
    ) {
      throw redirect(getRedirectPath());
    }

    const gstPercentage = await getAdminSetting("gst_percentage", "5");

    return {
      workshop,
      occurrence: occurrences[0],
      user,
      isMultiDayWorkshop: true,
      savedPaymentMethod,
      gstPercentage: parseFloat(gstPercentage),
      selectedVariation,
    };
  } else {
    throw new Response("Missing required parameters", { status: 400 });
  }
};

// Payment Component – renders UI based on whether which payment
export default function Payment() {
  const data = useLoaderData() as {
    membershipPlan?: any;
    user: any;
    upgradeFee: number;
    oldMembershipTitle?: string | null;
    oldMembershipPrice?: number | null;
    workshop?: any;
    occurrence?: any;
    isMultiDayWorkshop?: boolean;
    userActiveMembership?: any;
    isDowngrade?: boolean;
    isResubscription?: boolean;
    membershipRecordId?: string | null;
    oldMembershipNextPaymentDate?: Date | null;
    savedPaymentMethod?: any;
    gstPercentage: number;
    selectedVariation?: any;
    billingCycle?: "monthly" | "quarterly" | "semiannually" | "yearly";
    autoRenew?: boolean;
    changeNotAllowed?: boolean;
    needsPayment?: boolean;
  };

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuickCheckoutRedirecting, setIsQuickCheckoutRedirecting] = useState(false);

  const getMembershipPrice = () => {
    if (data.membershipPlan) {
      return data.membershipPlan.displayPrice || data.membershipPlan.price;
    }
    return 0;
  };

  const membershipPrice = getMembershipPrice();

  // The server prices and validates everything; show what it refuses.
  const fail = (message?: string) => {
    setError(message || "Something went wrong. Please try again.");
    setLoading(false);
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    try {
      if (data.membershipPlan) {
        if (data.isResubscription) {
          const res = await fetch("/dashboard/payment/resubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentMembershipId: data.membershipRecordId
                ? Number(data.membershipRecordId)
                : data.userActiveMembership?.id,
              membershipPlanId: data.membershipPlan.id,
              billingCycle: data.billingCycle || "monthly",
              autoRenew: data.autoRenew ?? true,
            }),
          });

          const json = await res.json().catch(() => ({}));
          if (json.success) {
            return navigate("/dashboard/payment/success?resubscribe=true");
          }
          fail(json.error);
        }

        // Downgrade branch
        else if (data.isDowngrade) {
          const res = await fetch("/dashboard/payment/downgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentMembershipId: data.userActiveMembership?.id,
              newMembershipPlanId: data.membershipPlan.id,
              billingCycle: data.billingCycle || "monthly",
              autoRenew: data.autoRenew ?? true,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (json.success) {
            return navigate("/dashboard/payment/success?downgrade=true");
          }
          fail(json.error);
        }

        // New membership or a paid upgrade; the server works out the amount.
        else {
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              membershipPlanId: data.membershipPlan.id,
              currentMembershipId: data.userActiveMembership?.id || null,
              billingCycle: data.billingCycle || "monthly",
              autoRenew: data.autoRenew ?? true,
            }),
          });
          const resData = await response.json();
          if (resData.url) {
            window.location.href = resData.url;
          } else if (resData.success === false && resData.error) {
            // If server says no payment required, trigger zero-cost upgrade
            if (
              resData.error.includes("No payment required") &&
              data.userActiveMembership &&
              data.billingCycle === "monthly"
            ) {
              const r = await fetch("/dashboard/payment/upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  currentMembershipId: data.userActiveMembership?.id,
                  newMembershipPlanId: data.membershipPlan.id,
                  billingCycle: data.billingCycle || "monthly",
                  autoRenew: data.autoRenew ?? true,
                }),
              });
              const j = await r.json().catch(() => ({}));
              if (j.success) {
                return navigate(
                  "/dashboard/payment/success?quick_checkout=true&type=membership"
                );
              }
              return fail(j.error);
            }
            fail(resData.error);
          } else {
            fail(resData.error);
          }
        }
      }

      // Workshop branch
      else {
        if (data.isMultiDayWorkshop) {
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workshopId: data.workshop.id,
              connectId: data.occurrence.connectId,
              variationId: data.selectedVariation?.id || null,
            }),
          });
          const resData = await response.json().catch(() => ({}));
          if (resData.url) {
            window.location.href = resData.url;
          } else {
            fail(resData.error);
          }
        } else {
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workshopId: data.workshop.id,
              occurrenceId: data.occurrence.id,
              variationId: data.selectedVariation?.id || null,
            }),
          });
          const resData = await response.json().catch(() => ({}));
          if (resData.url) {
            window.location.href = resData.url;
          } else {
            fail(resData.error);
          }
        }
      }
    } catch (error) {
      console.error("Payment error:", error);
      fail();
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 p-6 border rounded-lg shadow-lg bg-white">
      {/* Quick Checkout Section for Workshops - only show if price > 0 */}
      {data.workshop && data.savedPaymentMethod &&
        (data.selectedVariation ? data.selectedVariation.price : data.workshop.price) > 0 && (
        <div className="mb-6">
          <QuickCheckout
            checkoutData={{
              type: "workshop",
              workshopId: data.workshop.id,
              occurrenceId: data.isMultiDayWorkshop
                ? undefined
                : data.occurrence.id,
              connectId: data.isMultiDayWorkshop
                ? data.occurrence.connectId
                : undefined,
              variationId: data.selectedVariation?.id || null,
            }}
            itemName={data.workshop.name}
            itemPrice={
              data.selectedVariation
                ? data.selectedVariation.price
                : data.workshop.price
            }
            gstPercentage={data.gstPercentage}
            savedCard={{
              cardLast4: data.savedPaymentMethod.cardLast4,
              cardExpiry: data.savedPaymentMethod.cardExpiry,
            }}
            onSuccess={() => {
              console.log("Workshop payment successful!");
            }}
            onError={(error) => {
              console.error("Workshop payment failed:", error);
              setIsQuickCheckoutRedirecting(false);
            }}
            onRedirecting={setIsQuickCheckoutRedirecting}
          />

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <div className="mx-4 text-gray-500 text-sm">OR</div>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>
        </div>
      )}

      {/* Quick Checkout Section for Memberships */}
      {data.membershipPlan &&
        data.savedPaymentMethod &&
        !data.isResubscription &&
        !data.isDowngrade &&
        data.needsPayment && (
          <div className="mb-6">
            <QuickCheckout
              checkoutData={{
                type: "membership",
                membershipPlanId: data.membershipPlan.id,
                currentMembershipId: data.userActiveMembership?.id,
                billingCycle:
                  (data.billingCycle as
                    | "monthly"
                    | "quarterly"
                    | "semiannually"
                    | "yearly") || "monthly",
                autoRenew: data.autoRenew ?? true,
              }}
              itemName={data.membershipPlan.title}
              itemPrice={
                data.userActiveMembership ? data.upgradeFee : membershipPrice
              }
              gstPercentage={data.gstPercentage}
              savedCard={{
                cardLast4: data.savedPaymentMethod.cardLast4,
                cardExpiry: data.savedPaymentMethod.cardExpiry,
              }}
              onSuccess={() => {
                console.log("Membership payment successful!");
              }}
              onError={(error) => {
                console.error("Membership payment failed:", error);
                setIsQuickCheckoutRedirecting(false);
              }}
              onRedirecting={setIsQuickCheckoutRedirecting}
            />

            {/* Divider */}
            <div className="my-6 flex items-center">
              <div className="flex-1 border-t border-gray-300"></div>
              <div className="mx-4 text-gray-500 text-sm">OR</div>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
          </div>
        )}

      {data.membershipPlan ? (
        <>
          {/* Adjusted title based on isResubscription or isDowngrade */}
          <h2 className="text-xl font-bold mb-4">
            {data.isResubscription
              ? "Confirm Membership Resubscription"
              : data.isDowngrade
                ? "Confirm Membership Downgrade"
                : "Complete Your Membership Payment"}
          </h2>

          <p className="text-gray-700">Plan: {data.membershipPlan.title}</p>
          <p className="text-gray-700">
            Description: {data.membershipPlan.description}
          </p>

          {/* Show a message if user has an old membership */}
          {data.oldMembershipTitle && data.oldMembershipPrice && (
            <p className="mt-2 text-gray-700">
              Current membership: <strong>{data.oldMembershipTitle}</strong>{" "}
              (CA$
              {(
                data.oldMembershipPrice *
                (1 + data.gstPercentage / 100)
              ).toFixed(2)}
              /month incl. GST)
            </p>
          )}

          {data.changeNotAllowed && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-gray-700">
                Switching between non-monthly plans or to/from non-monthly terms
                isn't supported. Please cancel your current subscription and
                wait for it to end before subscribing to a different term.
              </p>
            </div>
          )}

          {!data.changeNotAllowed && (
            <>
              {/*
                If it's a resubscription, show a special message that no payment is required.
                If it's a downgrade, show the existing message that no payment is required.
                If it's an upgrade, show compensation details, etc.
              */}
              {data.isResubscription ? (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded">
                  <p className="text-gray-700">
                    You previously cancelled this membership. Resubscribing now
                    will reactivate it immediately.
                  </p>
                  <p className="font-semibold mt-2">
                    No payment is required for resubscription.
                  </p>
                </div>
              ) : data.isDowngrade ? (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded">
                  <p className="text-gray-700">
                    You will continue at your current rate of CA$
                    {data.oldMembershipPrice
                      ? (
                          data.oldMembershipPrice *
                          (1 + data.gstPercentage / 100)
                        ).toFixed(2)
                      : "0.00"}
                    /month until your next payment date at{" "}
                    {data.oldMembershipNextPaymentDate
                      ? formatBusinessDate(data.oldMembershipNextPaymentDate)
                      : "N/A"}
                    , then switch to CA$
                    {(membershipPrice * (1 + data.gstPercentage / 100)).toFixed(
                      2
                    )}
                    /month (incl. GST).
                  </p>
                  <p className="font-semibold mt-2">
                    No payment is required now.
                  </p>
                </div>
              ) : data.upgradeFee > 0 ? (
                <p className="mt-2 text-gray-700">
                  You'll pay a prorated amount of CA$
                  {(data.upgradeFee * (1 + data.gstPercentage / 100)).toFixed(
                    2
                  )}{" "}
                  now (incl. GST) to enjoy the benefits of{" "}
                  <strong>{data.membershipPlan.title}</strong>. Then, you will
                  pay{" "}
                  <strong>
                    CA$
                    {(membershipPrice * (1 + data.gstPercentage / 100)).toFixed(
                      2
                    )}
                    /month
                  </strong>{" "}
                  starting from{" "}
                  {data.oldMembershipNextPaymentDate
                    ? formatBusinessDate(data.oldMembershipNextPaymentDate)
                    : "N/A"}
                  .
                </p>
              ) : data.userActiveMembership ? (
                <p className="mt-2 text-gray-700">
                  Switching to the same price plan. No additional payment is
                  needed now.
                </p>
              ) : null}

              {/*
                If it's not a downgrade or resubscription, show "Total due now" message
                (in case of upgrade or brand-new membership).
              */}
              {!data.isDowngrade && !data.isResubscription && (
                <div className="mt-2">
                  <p className="text-lg font-semibold">
                    Total due now: CA$
                    {data.userActiveMembership
                      ? (
                          data.upgradeFee *
                          (1 + data.gstPercentage / 100)
                        ).toFixed(2)
                      : (
                          membershipPrice *
                          (1 + data.gstPercentage / 100)
                        ).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">
                    (Includes CA$
                    {data.userActiveMembership
                      ? (data.upgradeFee * (data.gstPercentage / 100)).toFixed(
                          2
                        )
                      : (membershipPrice * (data.gstPercentage / 100)).toFixed(
                          2
                        )}{" "}
                    GST)
                  </p>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // Workshop Payment UI
        <>
          {(() => {
            const workshopPrice = data.selectedVariation
              ? data.selectedVariation.price
              : data.workshop?.price || 0;
            const isFree = workshopPrice === 0;

            return (
              <>
                <h2 className="text-xl font-bold mb-4">
                  {isFree ? "Confirm Your Registration" : "Complete Your Payment"}
                </h2>
                <p className="text-gray-700">Workshop: {data.workshop?.name}</p>
                {data.selectedVariation && (
                  <p className="text-gray-700">
                    Option: {data.selectedVariation.name}
                  </p>
                )}
                {data.isMultiDayWorkshop ? (
                  <p className="text-gray-700">
                    Occurrence Group: {data.occurrence?.connectId}
                  </p>
                ) : (
                  <p className="text-gray-700">
                    Occurrence ID: {data.occurrence?.id}
                  </p>
                )}
                <div className="mt-2">
                  <p className="text-lg font-semibold">
                    Total: CA$
                    {(workshopPrice * (1 + data.gstPercentage / 100)).toFixed(2)}
                  </p>
                  {!isFree && (
                    <p className="text-sm text-gray-600">
                      (Includes CA$
                      {(workshopPrice * (data.gstPercentage / 100)).toFixed(2)} GST)
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm leading-relaxed text-red-700"
        >
          {error}
        </p>
      )}

      <Button
        onClick={handlePayment}
        disabled={loading || (data.membershipPlan && data.changeNotAllowed) || isQuickCheckoutRedirecting}
        className="mt-4 bg-blue-500 text-white w-full"
      >
        {loading ? "Processing..." : (() => {
          if (data.workshop) {
            const workshopPrice = data.selectedVariation
              ? data.selectedVariation.price
              : data.workshop.price;
            return workshopPrice === 0 ? "Confirm Registration" : "Proceed";
          }
          return "Proceed";
        })()}
      </Button>
    </div>
  );
}
