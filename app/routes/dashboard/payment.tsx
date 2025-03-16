import { useLoaderData, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getWorkshopById, getWorkshopOccurrence } from "../../models/workshop.server";
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

  // If the route includes membershipPlanId, assume membership payment
  if (params.membershipPlanId) {
    const membershipPlanId = Number(params.membershipPlanId);
    if (isNaN(membershipPlanId))
      throw new Response("Invalid membership plan ID", { status: 400 });

    const membershipPlan = await getMembershipPlanById(membershipPlanId);
    if (!membershipPlan)
      throw new Response("Membership Plan not found", { status: 404 });

    return { membershipPlan, user };
  } else if (params.workshopId && params.occurrenceId) {
    // Otherwise, load workshop & occurrence for workshop registration
    const workshopId = Number(params.workshopId);
    const occurrenceId = Number(params.occurrenceId);
    if (isNaN(workshopId) || isNaN(occurrenceId))
      throw new Response("Invalid workshop or occurrence ID", { status: 400 });

    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!workshop || !occurrence)
      throw new Response("Workshop or Occurrence not found", { status: 404 });

    return { workshop, occurrence, user };
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

    // If processing a membership payment
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
    } else {
      // Process workshop payment (existing logic)
      const { workshopId, occurrenceId, price, userId } = body;
      if (!workshopId || !occurrenceId || !price || !userId) {
        return new Response(JSON.stringify({ error: "Missing required payment data" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const workshop = await getWorkshopById(workshopId);
      const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
      if (!workshop || !occurrence) {
        return new Response(JSON.stringify({ error: "Workshop or Occurrence not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
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
        // Process workshop payment
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
          <p className="text-gray-700">Occurrence ID: {data.occurrence.id}</p>
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
