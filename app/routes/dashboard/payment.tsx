import { useLoaderData, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
} from "../../models/workshop.server";
import {
  getMembershipPlanById,
  getCancelledMembership,
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

    const cancelledMembership = await getCancelledMembership(user.id);

    let compensationPrice = 0;
    let adjustedPrice = membershipPlan.price; // Default full price

    let oldMembershipTitle = null;
    let oldMembershipPrice = null;

    // Only compute compensation if the user has a cancelled membership
    // that hasn't expired yet
    if (
      cancelledMembership &&
      new Date() < new Date(cancelledMembership.nextPaymentDate)
    ) {
      const now = new Date();
      const A = now.getTime() - new Date(cancelledMembership.date).getTime();
      const B =
        new Date(cancelledMembership.nextPaymentDate).getTime() - now.getTime();
      const total = A + B;

      // const oldPrice = cancelledMembership.membershipPlan.price;
      // const newPrice = membershipPlan.price;

      // const priceDiff = Math.abs(newPrice - oldPrice);
      // const ratio = B / total;
      // const partialDiff = ratio * priceDiff; // always positive

      // let adjustedPrice: number;
      // let compensationPrice: number; // or rename to partialCharge if you prefer

      // // Step 2: figure out if user is upgrading or downgrading
      // if (newPrice > oldPrice) {
      //   // Upgrading (new plan is more expensive)
      //   // The user pays: newPrice + partialDiff for the remainder of this cycle
      //   adjustedPrice = newPrice + partialDiff;
      //   compensationPrice = partialDiff; // “upgrade surcharge”
      // } else if (newPrice < oldPrice) {
      //   // Downgrading (new plan is cheaper)
      //   // The user pays: newPrice - partialDiff for the remainder of this cycle
      //   adjustedPrice = newPrice - partialDiff;
      //   compensationPrice = partialDiff; // “discount”
      // } else {
      //   // Same price, no partial difference
      //   adjustedPrice = newPrice;
      //   compensationPrice = 0;
      // }

      const oldPrice = cancelledMembership.membershipPlan.price;
      compensationPrice = (B / total) * (membershipPlan.price - oldPrice);
      adjustedPrice = membershipPlan.price - compensationPrice;

      oldMembershipTitle = cancelledMembership.membershipPlan.title;
      oldMembershipPrice = oldPrice;
    }

    return {
      membershipPlan,
      user,
      compensationPrice,
      adjustedPrice,
      oldMembershipTitle,
      oldMembershipPrice,
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
    compensationPrice?: number;
    adjustedPrice?: number;
    oldMembershipTitle?: string | null;
    oldMembershipPrice?: number | null;
    workshop?: any;
    occurrence?: any;
    isContinuation?: boolean;
  };

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (data.membershipPlan) {
        const response = await fetch("/dashboard/paymentprocess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            membershipPlanId: data.membershipPlan.id,
            price: data.adjustedPrice ?? data.membershipPlan.price,
            userId: data.user.id,
            compensationPrice: data.compensationPrice ?? 0,
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
            Complete Your Membership Payment
          </h2>
          <p className="text-gray-700">Plan: {data.membershipPlan.title}</p>
          <p className="text-gray-700">
            Description: {data.membershipPlan.description}
          </p>

          {/* Only show old membership details if they exist */}
          {data.oldMembershipTitle && data.oldMembershipPrice ? (
            <>
              <p className="mt-2 text-gray-700">
                You canceled your previous membership called{" "}
                <strong>{data.oldMembershipTitle}</strong> early worth $
                {data.oldMembershipPrice.toFixed(2)}
              </p>
            </>
          ) : null}

          {/* Only show compensation details if there's a positive compensationPrice */}
          {data.compensationPrice && data.compensationPrice > 0 ? (
            <p className="mt-2 text-gray-700">
              For this billing cycle, you'll pay $
              {data.adjustedPrice?.toFixed(2)} (due to $
              {data.compensationPrice.toFixed(2)} compensation), and you'll pay
              the full ${data.membershipPlan.price.toFixed(2)} next cycle.
            </p>
          ) : null}

          {/* Always show the final total */}
          <p className="text-lg font-semibold mt-2">
            Total: $
            {data.adjustedPrice
              ? data.adjustedPrice.toFixed(2)
              : data.membershipPlan.price.toFixed(2)}
          </p>
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
