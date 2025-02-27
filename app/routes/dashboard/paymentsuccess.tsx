import { useLoaderData, useNavigate } from "react-router-dom";
import { Stripe } from "stripe";
import { registerForWorkshop } from "../../models/workshop.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    throw new Response("Missing session_id", { status: 400 });
  }

  // Initialize Stripe with your secret key
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  // Retrieve the Checkout Session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const metadata = session.metadata || {};
  const { workshopId, occurrenceId, userId } = metadata;

  if (!workshopId || !occurrenceId || !userId) {
    throw new Response(
      "Missing registration parameters in session metadata",
      { status: 400 }
    );
  }

  try {
    // Call registerForWorkshop with the parameters from metadata
    await registerForWorkshop(
      parseInt(workshopId),
      parseInt(occurrenceId),
      parseInt(userId)
    );
    return new Response(
      JSON.stringify({
        success: true,
        message: "🎉 Registration successful! A confirmation email has been sent.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Registration failed: " + error.message,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}

export default function PaymentSuccess() {
  const data = useLoaderData() as { success: boolean; message: string };
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">
        {data.success ? "Payment Successful!" : "Payment Failed"}
      </h2>
      <p>{data.message}</p>
      <button
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() => navigate("/dashboard/workshops")}
      >
        Back to Workshops
      </button>
    </div>
  );
}
