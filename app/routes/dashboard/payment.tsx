import { useLoaderData, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
} from "../../models/workshop.server";
import {
  getMembershipPlanById,
  getUserActiveMembership,
} from "../../models/membership.server"; // make sure to implement this
import { getUser } from "~/utils/session.server";
import { useState } from "react";
import { Stripe } from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Loader: load either workshop data or membership plan data based on route parameters
export async function loader({ params, request }) {
  const user = await getUser(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  if (params.membershipPlanId) {
    const membershipPlanId = Number(params.membershipPlanId);
    if (isNaN(membershipPlanId))
      throw new Response("Invalid membership plan ID", { status: 400 });

    const membershipPlan = await getMembershipPlanById(membershipPlanId);
    if (!membershipPlan)
      throw new Response("Membership Plan not found", { status: 404 });

    // Get user's active membership if any
    const userActiveMembership = await getUserActiveMembership(user.id);

    let compensationPrice = 0;
    let adjustedPrice = membershipPlan.price; // Default full price
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
      const A = now.getTime() - new Date(userActiveMembership.date).getTime();
      const B =
        new Date(userActiveMembership.nextPaymentDate).getTime() -
        now.getTime();
      const total = A + B;

      // Check if this is an upgrade or downgrade
      if (newPrice > oldPrice) {
        // Upgrade: calculate the prorated price difference
        compensationPrice = (B / total) * (newPrice - oldPrice);
        adjustedPrice = newPrice - compensationPrice;
      } else if (newPrice < oldPrice) {
        // Downgrade: no immediate charge, just pay the old price until next cycle
        isDowngrade = true;
        adjustedPrice = 0; // No immediate payment needed
      } else {
        // Same price, no change needed
        adjustedPrice = 0; // No immediate payment needed
      }

      oldMembershipTitle = userActiveMembership.membershipPlan.title;
      oldMembershipPrice = oldPrice;
      oldMembershipNextPaymentDate = userActiveMembership.nextPaymentDate
        ? new Date(userActiveMembership.nextPaymentDate).toISOString() // NEW: Convert to ISO string
        : null;
    } else {
      // New membership, pay full price
      adjustedPrice = membershipPlan.price;
    }

    return {
      membershipPlan,
      user,
      compensationPrice,
      adjustedPrice,
      oldMembershipTitle,
      oldMembershipPrice,
      userActiveMembership,
      oldMembershipNextPaymentDate,
      isDowngrade,
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

    return { workshop, occurrence, user, isContinuation: false };
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
    return { workshop, occurrence: occurrences[0], user, isContinuation: true };
  } else {
    throw new Response("Missing required parameters", { status: 400 });
  }
}

// Action: create a Stripe Checkout Session for the appropriate payment type
export async function action({ request }) {
  try {
    const body = await request.json();
    const user = await getUser(request);
    if (!user)
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    if (body.membershipPlanId) {
      const { membershipPlanId, price, userId, compensationPrice } = body;
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
                description:
                  membershipPlan.description +
                  (compensationPrice > 0
                    ? ` (Compensation applied: $${Number(
                        compensationPrice
                      ).toFixed(2)})`
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
          compensationPrice: compensationPrice
            ? compensationPrice.toString()
            : "0",
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
    console.error("Stripe Checkout Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Payment Component – renders UI based on whether it's a membership or workshop payment
// Payment Component
export default function Payment() {
  const data = useLoaderData() as {
    membershipPlan?: any;
    user: any;
    compensationPrice: number;
    adjustedPrice: number;
    oldMembershipTitle?: string | null;
    oldMembershipPrice?: number | null;
    workshop?: any;
    occurrence?: any;
    isContinuation?: boolean;
    userActiveMembership?: any;
    isDowngrade?: boolean;
    oldMembershipNextPaymentDate?: Date | null;
  };

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (data.membershipPlan) {
        if (data.isDowngrade) {
          // Handle downgrade - no payment needed, just update the database
          const response = await fetch("/dashboard/membership/change", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentMembershipId: data.userActiveMembership.id,
              newMembershipPlanId: data.membershipPlan.id,
              userId: data.user.id,
              isDowngrade: true,
            }),
          });
          const resData = await response.json();
          if (resData.success) {
            navigate("/dashboard/memberships?status=downgrade-success");
          } else {
            console.error("Downgrade error:", resData.error);
            setLoading(false);
          }
        } else {
          // Process payment for new membership or upgrade
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              membershipPlanId: data.membershipPlan.id,
              price: data.userActiveMembership
                ? data.compensationPrice
                : data.adjustedPrice,
              userId: data.user.id,
              oldMembershipNextPaymentDate: data.oldMembershipNextPaymentDate,
              compensationPrice: data.compensationPrice ?? 0,
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
      } else {
        // Process workshop payment (unchanged)
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
      {data.membershipPlan ? (
        <>
          <h2 className="text-xl font-bold mb-4">
            {data.isDowngrade
              ? "Confirm Membership Downgrade"
              : "Complete Your Membership Payment"}
          </h2>
          <p className="text-gray-700">Plan: {data.membershipPlan.title}</p>
          <p className="text-gray-700">
            Description: {data.membershipPlan.description}
          </p>

          {/* Show current membership details if they exist */}
          {data.oldMembershipTitle && data.oldMembershipPrice ? (
            <>
              <p className="mt-2 text-gray-700">
                Current membership: <strong>{data.oldMembershipTitle}</strong>{" "}
                (${data.oldMembershipPrice.toFixed(2)}/month)
              </p>
            </>
          ) : null}

          {/* Show different content based on upgrade/downgrade */}
          {data.isDowngrade ? (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded">
              <p className="text-gray-700">
                You will continue at your current rate of $
                {data.oldMembershipPrice?.toFixed(2)}/month until your next
                payment date, then switch to $
                {data.membershipPlan.price.toFixed(2)}/month.
              </p>
              <p className="font-semibold mt-2">No payment is required now.</p>
            </div>
          ) : data.compensationPrice && data.compensationPrice > 0 ? (
            <p className="mt-2 text-gray-700">
              You'll pay a prorated amount of $
              {data.compensationPrice.toFixed(2)} now to enjoy the benefits of{" "}
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

          {/* Show the final total */}
          {!data.isDowngrade && (
            <p className="text-lg font-semibold mt-2">
              Total due now: $
              {data.userActiveMembership
                ? // If user already has a membership, show the compensation price
                  data.compensationPrice.toFixed(2)
                : // Otherwise, user is new -> show adjustedPrice (full membership price)
                  data.adjustedPrice.toFixed(2)}
            </p>
          )}
        </>
      ) : (
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
        {loading ? "Processing..." : "Proceed to Payment"}
      </Button>
    </div>
  );
}
