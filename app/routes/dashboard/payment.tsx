import { useLoaderData, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getWorkshopById, getWorkshopOccurrence, getWorkshopOccurrencesByConnectId } from "../../models/workshop.server";
import { getMembershipPlanById } from "../../models/membership.server"; // make sure to implement this
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

  // Membership payment branch
  if (params.membershipPlanId) {
    const membershipPlanId = Number(params.membershipPlanId);
    if (isNaN(membershipPlanId))
      throw new Response("Invalid membership plan ID", { status: 400 });

    const membershipPlan = await getMembershipPlanById(membershipPlanId);
    if (!membershipPlan)
      throw new Response("Membership Plan not found", { status: 404 });

    return { membershipPlan, user };
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
    const occurrences = await getWorkshopOccurrencesByConnectId(workshopId, connectId);
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

    // Membership branch
    if (body.membershipPlanId) {
      const { membershipPlanId, price, userId } = body;
      if (!membershipPlanId || !price || !userId) {
        return new Response(
          JSON.stringify({ error: "Missing required membership payment data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const membershipPlan = await getMembershipPlanById(Number(membershipPlanId));
      if (!membershipPlan) {
        return new Response(
          JSON.stringify({ error: "Membership Plan not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create Stripe Checkout Session for membership
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: membershipPlan.title,
                description: membershipPlan.description,
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
                description: `Occurrence on ${new Date(occurrence.startDate).toLocaleString()}`,
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
      const occurrences = await getWorkshopOccurrencesByConnectId(workshopId, Number(connectId));
      if (!workshop || !occurrences || occurrences.length === 0) {
        return new Response(JSON.stringify({ error: "Workshop or Occurrences not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
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
                description: `Occurrences starting on ${new Date(firstOccurrence.startDate).toLocaleString()}`,
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
      throw new Response("Missing required payment parameters", { status: 400 });
    }
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Payment Component – renders UI based on whether it's a membership or workshop payment
export default function Payment() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (data.membershipPlan) {
        // Process membership payment
        const response = await fetch("/dashboard/paymentprocess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            membershipPlanId: data.membershipPlan.id,
            price: data.membershipPlan.price,
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
        // Process workshop payment – check if it's a continuation
        if (data.isContinuation) {
          const response = await fetch("/dashboard/paymentprocess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workshopId: data.workshop.id,
              connectId: data.occurrence.connectId, // use connectId
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
          // Standard workshop payment using occurrenceId
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
          <h2 className="text-xl font-bold mb-4">Complete Your Membership Payment</h2>
          <p className="text-gray-700">Plan: {data.membershipPlan.title}</p>
          <p className="text-gray-700">Description: {data.membershipPlan.description}</p>
          <p className="text-lg font-semibold mt-2">Total: ${data.membershipPlan.price}</p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-4">Complete Your Payment</h2>
          <p className="text-gray-700">Workshop: {data.workshop.name}</p>
          {data.isContinuation ? (
            <p className="text-gray-700">
              Occurrence Group: {data.occurrence.connectId}
            </p>
          ) : (
            <p className="text-gray-700">Occurrence ID: {data.occurrence.id}</p>
          )}
          <p className="text-lg font-semibold mt-2">Total: ${data.workshop.price}</p>
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
