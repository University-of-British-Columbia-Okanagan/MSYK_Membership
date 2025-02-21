import { useLoaderData, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getWorkshopById, getWorkshopOccurrence } from "../../models/workshop.server";
import { getUser } from "~/utils/session.server";
import { useState } from "react";
import { Stripe } from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// 👇 **Load Workshop & Occurrence Data**
export async function loader({ params, request }) {
  console.log("Received params:", params);

  if (!params.workshopId || !params.occurrenceId) {
    throw new Response("Missing required parameters", { status: 400 });
  }

  const workshopId = Number(params.workshopId);
  const occurrenceId = Number(params.occurrenceId);

  if (isNaN(workshopId) || isNaN(occurrenceId)) {
    throw new Response("Invalid workshop or occurrence ID", { status: 400 });
  }

  console.log(`Fetching data for workshopId=${workshopId}, occurrenceId=${occurrenceId}`);

  const user = await getUser(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const workshop = await getWorkshopById(workshopId);
  const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);

  if (!workshop || !occurrence) {
    throw new Response("Workshop or Occurrence not found", { status: 404 });
  }

  return { workshop, occurrence, user };
}

//Handle Checkout Request
export async function action({ request }) {
  try {
    const body = await request.json();
    const { workshopId, occurrenceId, price, userId } = body;

    if (!workshopId || !occurrenceId || !price || !userId) {
      return json({ error: "Missing required payment data" }, { status: 400 });
    }

    // Fetch Workshop & Occurrence
    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!workshop || !occurrence) {
      return json({ error: "Workshop or Occurrence not found" }, { status: 404 });
    }

    // Create Stripe Checkout Session
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
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      success_url: `http://localhost:5174/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5174/dashboard/workshops`,
      metadata: {
        workshopId: workshopId.toString(),
        occurrenceId: occurrenceId.toString(),
        userId: userId.toString(),
      },
    });

    return json({ url: session.url });

  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

//Payment Component
export default function Payment() {
  const { workshop, occurrence, user } = useLoaderData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
  
    try {
      const response = await fetch("/dashboard/paymentprocess", {  
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId: workshop.id,
          occurrenceId: occurrence.id,
          price: workshop.price,
          userId: user.id,
        }),
      });
  
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        console.error("Payment error:", data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      setLoading(false);
    }
  };
  

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg shadow-lg bg-white">
      <h2 className="text-xl font-bold mb-4">Complete Your Payment</h2>
      <p className="text-gray-700">Workshop: {workshop.name}</p>
      <p className="text-gray-700">Occurrence ID: {occurrence.id}</p>
      <p className="text-lg font-semibold mt-2">Total: ${workshop.price}</p>

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
