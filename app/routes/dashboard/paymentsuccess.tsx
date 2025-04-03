import { useLoaderData, useNavigate } from "react-router-dom";
import { Stripe } from "stripe";
import {
  registerForWorkshop,
  registerUserForAllOccurrences, // <--- Import the new helper
} from "../../models/workshop.server";
import {registerMembershipSubscription,} from "../../models/membership.server"

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    throw new Response("Missing session_id", { status: 400 });
  }

  // Initialize Stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  // Retrieve Checkout Session
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const metadata = session.metadata || {};
  const {
    workshopId,
    occurrenceId,
    membershipPlanId,
    userId,
    connectId, // <--- Check for connectId
    compensationPrice,
  } = metadata;

  // Membership branch
  if (membershipPlanId) {
    try {
      const compPrice = compensationPrice ? parseFloat(compensationPrice) : 0;
      const currentMembershipId = metadata.currentMembershipId ? 
        parseInt(metadata.currentMembershipId) : null;
      
      await registerMembershipSubscription(
        parseInt(userId),
        parseInt(membershipPlanId),
        compPrice,
        currentMembershipId
      );
  
      return new Response(
        JSON.stringify({
          success: true,
          isMembership: true,
          message:
            "🎉 Membership subscription successful! A confirmation email has been sent.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          success: false,
          isMembership: true,
          message: "Membership subscription failed: " + error.message,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // NEW: Workshop continuation branch
  else if (workshopId && connectId && userId) {
    try {
      await registerUserForAllOccurrences(
        parseInt(workshopId),
        parseInt(connectId),
        parseInt(userId)
      );
      return new Response(
        JSON.stringify({
          success: true,
          isMembership: false,
          message:
            "🎉 Registration successful for all occurrences! A confirmation email has been sent.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          success: false,
          isMembership: false,
          message: "Registration (continuation) failed: " + error.message,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Single-occurrence workshop branch
  else if (workshopId && occurrenceId && userId) {
    try {
      await registerForWorkshop(
        parseInt(workshopId),
        parseInt(occurrenceId),
        parseInt(userId)
      );
      return new Response(
        JSON.stringify({
          success: true,
          isMembership: false,
          message:
            "🎉 Registration successful! A confirmation email has been sent.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          success: false,
          isMembership: false,
          message: "Registration failed: " + error.message,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    throw new Response("Missing registration parameters in session metadata", {
      status: 400,
    });
  }
}

export default function PaymentSuccess() {
  const data = useLoaderData() as {
    success: boolean;
    isMembership?: boolean;
    message: string;
  };
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">
        {data.success ? "Payment Successful!" : "Payment Failed"}
      </h2>
      <p>{data.message}</p>
      <button
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() =>
          navigate(data.isMembership ? "/memberships" : "/dashboard/workshops")
        }
      >
        {data.isMembership ? "Back to Memberships" : "Back to Workshops"}
      </button>
    </div>
  );
}
