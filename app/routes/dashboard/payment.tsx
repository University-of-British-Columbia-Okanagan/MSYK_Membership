import { useLoaderData, useNavigate } from "react-router-dom";
import type { LoaderFunction } from "react-router";
import { Button } from "@/components/ui/button";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
} from "../../models/workshop.server";
import {
  getMembershipPlanById,
  getUserActiveMembership,
} from "../../models/membership.server";
import { getUser } from "~/utils/session.server";
import { useState } from "react";
import { Stripe } from "stripe";
import { getSavedPaymentMethod } from "../../models/user.server";
import QuickCheckout from "@/components/ui/Dashboard/quickcheckout";
import { logger } from "~/logging/logger";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Loader: load either workshop data or membership plan data based on route parameters
export const loader: LoaderFunction = async ({ params, request }) => {
  const user = await getUser(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const savedPaymentMethod = await getSavedPaymentMethod(user.id);

  if (params.membershipPlanId) {
    const membershipPlanId = Number(params.membershipPlanId);
    if (isNaN(membershipPlanId))
      throw new Response("Invalid membership plan ID", { status: 400 });

    const membershipPlan = await getMembershipPlanById(membershipPlanId);
    if (!membershipPlan)
      throw new Response("Membership Plan not found", { status: 404 });

    // Get user's active membership if any
    const userActiveMembership = await getUserActiveMembership(user.id);

    let upgradeFee = 0;
    let oldMembershipTitle = null;
    let oldMembershipPrice = null;
    let oldMembershipNextPaymentDate = null;
    let isDowngrade = false;

    // Only compute compensation if the user has an active membership
    if (userActiveMembership) {
      const now = new Date();
      const oldPrice = userActiveMembership.membershipPlan.price;
      const newPrice = membershipPlan.price;

      // Calculate the time portions
      // const A = now.getTime() - new Date(userActiveMembership.date).getTime();
      // const B =
      //   new Date(userActiveMembership.nextPaymentDate).getTime() -
      //   now.getTime();
      // const total = A + B;

      const oneMonthMs = 30 * 24 * 60 * 60 * 1000; // Approx one month in milliseconds
      // Instead of using the original signup date for A, use a date exactly one month before the next payment
      const nextPaymentDate = new Date(userActiveMembership.nextPaymentDate);
      const effectiveStartDate = new Date(nextPaymentDate);
      effectiveStartDate.setMonth(effectiveStartDate.getMonth() - 1);
      // A is now the time already used in the current billing cycle
      const A = now.getTime() - effectiveStartDate.getTime();
      // B remains the time left until next payment
      const B = nextPaymentDate.getTime() - now.getTime();
      const total = A + B; // This will now be approximately one month

      // Check if this is an upgrade or downgrade
      if (newPrice > oldPrice) {
        upgradeFee = (B / total) * (newPrice - oldPrice);
      } else if (newPrice < oldPrice) {
        isDowngrade = true;
      }

      oldMembershipTitle = userActiveMembership.membershipPlan.title;
      oldMembershipPrice = oldPrice;
      oldMembershipNextPaymentDate = userActiveMembership.nextPaymentDate
        ? new Date(userActiveMembership.nextPaymentDate).toISOString() // NEW: Convert to ISO string
        : null;
    }

    let isResubscription = false;
    if (
      userActiveMembership &&
      userActiveMembership.status === "cancelled" &&
      membershipPlan.id === userActiveMembership.membershipPlanId
    ) {
      isResubscription = true;
      upgradeFee = 0; // No payment needed for resubscription
    }

    // NEW: Override isResubscription flag if query parameter "resubscribe" is present
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.get("resubscribe") === "true") {
      isResubscription = true;
    }


    return {
      membershipPlan,
      user,
      upgradeFee,
      oldMembershipTitle,
      oldMembershipPrice,
      userActiveMembership,
      oldMembershipNextPaymentDate,
      isDowngrade,
      isResubscription,
      savedPaymentMethod,
    };
  }
  // Workshop branch: either single occurrence or continuation
  else if (params.workshopId && params.occurrenceId) {
    const workshopId = Number(params.workshopId);
    const occurrenceId = Number(params.occurrenceId);
    if (isNaN(workshopId) || isNaN(occurrenceId))
      throw new Response("Invalid workshop or occurrence ID", { status: 400 });

    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!workshop || !occurrence)
      throw new Response("Workshop or Occurrence not found", { status: 404 });

    return {
      workshop,
      occurrence,
      user,
      isContinuation: false,
      savedPaymentMethod,
    };
  } else if (params.workshopId && params.connectId) {
    // New branch for continuation workshops using connectId
    const workshopId = Number(params.workshopId);
    const connectId = Number(params.connectId);
    if (isNaN(workshopId) || isNaN(connectId))
      throw new Response("Invalid workshop or connect ID", { status: 400 });

    const workshop = await getWorkshopById(workshopId);
    // getWorkshopOccurrencesByConnectId should return an array of occurrences for this workshop with the given connectId
    const occurrences = await getWorkshopOccurrencesByConnectId(
      workshopId,
      connectId
    );
    if (!workshop || !occurrences || occurrences.length === 0)
      throw new Response("Workshop or Occurrences not found", { status: 404 });

    // For payment, we use the first occurrence as a representative
    return {
      workshop,
      occurrence: occurrences[0],
      user,
      isContinuation: true,
      savedPaymentMethod,
    };
  } else {
    throw new Response("Missing required parameters", { status: 400 });
  }
};

// Action: create a Stripe Checkout Session for the appropriate payment type
export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const user = await getUser(request);
    if (!user)
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    if (body.membershipPlanId) {
      const { membershipPlanId, price, userId, upgradeFee } = body;
      if (!membershipPlanId || price === undefined || !userId) {
        return new Response(
          JSON.stringify({ error: "Missing required membership payment data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const membershipPlan = await getMembershipPlanById(
        Number(membershipPlanId)
      );
      if (!membershipPlan) {
        return new Response(
          JSON.stringify({ error: "Membership Plan not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: membershipPlan.title,
                // ▼ use upgradeFee for description ▼
                description:
                  membershipPlan.description +
                  (upgradeFee > 0
                    ? ` (Upgrade fee: $${upgradeFee.toFixed(2)})`
                    : ""),
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: user.email,
        success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5173/dashboard/memberships`,
        metadata: {
          membershipPlanId: membershipPlanId.toString(),
          userId: userId.toString(),
          upgradeFee: upgradeFee.toString(),
          currentMembershipId: (body.currentMembershipId || "").toString(),
          originalPrice: membershipPlan.price.toString(),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Workshop branch: standard single occurrence registration
    else if (body.workshopId && body.occurrenceId) {
      const { workshopId, occurrenceId, price, userId } = body;
      if (!workshopId || !occurrenceId || !price || !userId) {
        return new Response(
          JSON.stringify({ error: "Missing required payment data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const workshop = await getWorkshopById(workshopId);
      const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
      if (!workshop || !occurrence) {
        return new Response(
          JSON.stringify({ error: "Workshop or Occurrence not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: workshop.name,
                description: `Occurrence on ${new Date(
                  occurrence.startDate
                ).toLocaleString()}`,
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: user.email,
        success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5173/dashboard/workshops`,
        metadata: {
          workshopId: workshopId.toString(),
          occurrenceId: occurrenceId.toString(),
          userId: userId.toString(),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // NEW: Workshop continuation branch: using connectId
    else if (body.workshopId && body.connectId) {
      const { workshopId, connectId, price, userId } = body;
      if (!workshopId || !connectId || !price || !userId) {
        return new Response(
          JSON.stringify({ error: "Missing required payment data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const workshop = await getWorkshopById(workshopId);
      // Use the helper to get all occurrences with the given connectId; pick the first one
      const occurrences = await getWorkshopOccurrencesByConnectId(
        workshopId,
        Number(connectId)
      );
      if (!workshop || !occurrences || occurrences.length === 0) {
        return new Response(
          JSON.stringify({ error: "Workshop or Occurrences not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const firstOccurrence = occurrences[0];

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: workshop.name,
                description: `Occurrences starting on ${new Date(
                  firstOccurrence.startDate
                ).toLocaleString()}`,
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: user.email,
        success_url: `http://localhost:5173/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5173/dashboard/workshops`,
        metadata: {
          workshopId: workshopId.toString(),
          connectId: connectId.toString(),
          userId: userId.toString(),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      throw new Response("Missing required payment parameters", {
        status: 400,
      });
    }
  } catch (error) {
    logger.error(`Stripe Checkout Error: ${error}`, {url: request.url,});
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

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
    isContinuation?: boolean;
    userActiveMembership?: any;
    isDowngrade?: boolean;
    isResubscription?: boolean;
    oldMembershipNextPaymentDate?: Date | null;
    savedPaymentMethod?: any;
  };

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (data.membershipPlan) {
        if (data.isResubscription) {
          const res = await fetch("/dashboard/payment/resubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentMembershipId: data.userActiveMembership?.id,
              membershipPlanId: data.membershipPlan.id,
              userId: data.user.id,
            }),
          });
          const json = await res.json();
          if (json.success) {
            return navigate("/dashboard/payment/success?resubscribe=true");
          } else {
            console.error("Resubscription error:", json.error);
          }
        }

        // Downgrade branch
        else if (data.isDowngrade) {
          const res = await fetch("/dashboard/payment/downgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentMembershipId: data.userActiveMembership?.id,
              newMembershipPlanId: data.membershipPlan.id,
              userId: data.user.id,
            }),
          });
          const json = await res.json();
          if (json.success) {
            return navigate("/dashboard/payment/success?downgrade=true");
          } else {
            console.error("Downgrade error:", json.error);
          }
        } else {
          // ▼ use `upgradeFee` for upgrades, otherwise full price ▼
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              membershipPlanId: data.membershipPlan.id,
              price: data.userActiveMembership
                ? data.upgradeFee
                : data.membershipPlan.price,
              userId: data.user.id,
              oldMembershipNextPaymentDate: data.oldMembershipNextPaymentDate,
              // ▼ send upgradeFee here ▼
              upgradeFee: data.upgradeFee,
              currentMembershipId: data.userActiveMembership?.id || null,
            }),
          });
          const resData = await response.json();
          if (resData.url) {
            window.location.href = resData.url;
          } else {
            console.error("Payment error:", resData.error);
            setLoading(false);
          }
        }
      }

      // Workshop branch (unchanged)
      else {
        if (data.isContinuation) {
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workshopId: data.workshop.id,
              connectId: data.occurrence.connectId,
              price: data.workshop.price,
              userId: data.user.id,
            }),
          });
          const resData = await response.json();
          if (resData.url) {
            window.location.href = resData.url;
          } else {
            console.error("Payment error:", resData.error);
            setLoading(false);
          }
        } else {
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workshopId: data.workshop.id,
              occurrenceId: data.occurrence.id,
              price: data.workshop.price,
              userId: data.user.id,
            }),
          });
          const resData = await response.json();
          if (resData.url) {
            window.location.href = resData.url;
          } else {
            console.error("Payment error:", resData.error);
            setLoading(false);
          }
        }
      }
    } catch (error) {
      console.error("Payment error:", error);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg shadow-lg bg-white">
      {/* Quick Checkout Section for Workshops */}
      {data.workshop && data.savedPaymentMethod && (
        <div className="mb-6">
          <QuickCheckout
            userId={data.user.id}
            checkoutData={{
              type: "workshop",
              workshopId: data.workshop.id,
              occurrenceId: data.isContinuation
                ? undefined
                : data.occurrence.id,
              connectId: data.isContinuation
                ? data.occurrence.connectId
                : undefined,
            }}
            itemName={data.workshop.name}
            itemPrice={data.workshop.price}
            savedCard={{
              cardLast4: data.savedPaymentMethod.cardLast4,
              cardExpiry: data.savedPaymentMethod.cardExpiry,
            }}
            onSuccess={() => {
              console.log("Workshop payment successful!");
            }}
            onError={(error) => {
              console.error("Workshop payment failed:", error);
            }}
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
        !data.isDowngrade && (
          <div className="mb-6">
            <QuickCheckout
              userId={data.user.id}
              checkoutData={{
                type: "membership",
                membershipPlanId: data.membershipPlan.id,
                price: data.userActiveMembership
                  ? data.upgradeFee
                  : data.membershipPlan.price,
                currentMembershipId: data.userActiveMembership?.id,
                upgradeFee: data.upgradeFee,
              }}
              itemName={data.membershipPlan.title}
              itemPrice={
                data.userActiveMembership
                  ? data.upgradeFee
                  : data.membershipPlan.price
              }
              savedCard={{
                cardLast4: data.savedPaymentMethod.cardLast4,
                cardExpiry: data.savedPaymentMethod.cardExpiry,
              }}
              onSuccess={() => {
                console.log("Membership payment successful!");
              }}
              onError={(error) => {
                console.error("Membership payment failed:", error);
              }}
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
              Current membership: <strong>{data.oldMembershipTitle}</strong> ($
              {data.oldMembershipPrice.toFixed(2)}/month)
            </p>
          )}

          {/* 
            If it's a resubscription, show a special message that no payment is required.
            If it's a downgrade, show the existing message that no payment is required.
            If it's an upgrade, show compensation details, etc.
          */}
          {data.isResubscription ? (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded">
              <p className="text-gray-700">
                You previously cancelled this membership. Resubscribing now will
                reactivate it immediately.
              </p>
              <p className="font-semibold mt-2">
                No payment is required for resubscription.
              </p>
            </div>
          ) : data.isDowngrade ? (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded">
              <p className="text-gray-700">
                You will continue at your current rate of $
                {data.oldMembershipPrice?.toFixed(2)}/month until your next
                payment date at{" "}
                {data.oldMembershipNextPaymentDate
                  ? new Date(
                      data.oldMembershipNextPaymentDate
                    ).toLocaleDateString()
                  : "N/A"}
                , then switch to ${data.membershipPlan.price.toFixed(2)}/month.
              </p>
              <p className="font-semibold mt-2">No payment is required now.</p>
            </div>
          ) : data.upgradeFee > 0 ? (
            <p className="mt-2 text-gray-700">
              You'll pay a prorated amount of ${data.upgradeFee.toFixed(2)} now
              to enjoy the benefits of{" "}
              <strong>{data.membershipPlan.title}</strong>. Then, you will pay{" "}
              <strong>${data.membershipPlan.price.toFixed(2)}/month</strong>{" "}
              starting from{" "}
              {data.oldMembershipNextPaymentDate
                ? new Date(
                    data.oldMembershipNextPaymentDate
                  ).toLocaleDateString()
                : "N/A"}
              .
            </p>
          ) : data.userActiveMembership ? (
            <p className="mt-2 text-gray-700">
              Switching to the same price plan. No additional payment is needed
              now.
            </p>
          ) : null}

          {/* 
            If it's not a downgrade or resubscription, show "Total due now" message
            (in case of upgrade or brand-new membership).
          */}
          {!data.isDowngrade && !data.isResubscription && (
            <p className="text-lg font-semibold mt-2">
              Total due now: $
              {data.userActiveMembership
                ? data.upgradeFee.toFixed(2)
                : data.membershipPlan.price.toFixed(2)}
            </p>
          )}
        </>
      ) : (
        // Workshop Payment UI (unchanged)
        <>
          <h2 className="text-xl font-bold mb-4">Complete Your Payment</h2>
          <p className="text-gray-700">Workshop: {data.workshop?.name}</p>
          {data.isContinuation ? (
            <p className="text-gray-700">
              Occurrence Group: {data.occurrence?.connectId}
            </p>
          ) : (
            <p className="text-gray-700">
              Occurrence ID: {data.occurrence?.id}
            </p>
          )}
          <p className="text-lg font-semibold mt-2">
            Total: ${data.workshop?.price.toFixed(2)}
          </p>
        </>
      )}

      <Button
        onClick={handlePayment}
        disabled={loading}
        className="mt-4 bg-blue-500 text-white w-full"
      >
        {loading ? "Processing..." : "Proceed"}
      </Button>
    </div>
  );
}
