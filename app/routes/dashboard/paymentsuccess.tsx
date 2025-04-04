import { useLoaderData, useNavigate } from "react-router-dom";
import { Stripe } from "stripe";
import {
  registerForWorkshop,
  registerUserForAllOccurrences,
} from "../../models/workshop.server";
import { registerMembershipSubscription } from "../../models/membership.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const isDowngrade = url.searchParams.get("downgrade") === "true";
  const isResubscribe = url.searchParams.get("resubscribe") === "true";
  if (isDowngrade) {
    return new Response(
      JSON.stringify({
        success: true,
        isMembership: true,
        message:
          "🎉 Membership downgrade scheduled! Your downgraded plan will begin at the end of your current billing cycle. You'll continue to enjoy your current benefits until then. A confirmation email has been sent.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  if (isResubscribe) {
    return new Response(
      JSON.stringify({
        success: true,
        isMembership: true,
        message:
          "🎉 Membership reactivated! Your membership has been successfully reactivated. You'll continue to enjoy your membership benefits. A confirmation email has been sent.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    throw new Response("Missing session_id", { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const metadata = session.metadata || {};
  const {
    workshopId,
    occurrenceId,
    membershipPlanId,
    userId,
    connectId,
    compensationPrice,
    equipmentId,
    slots,
  } = metadata;

  // Equipment booking branch (redirect immediately to dashboard)
  if (equipmentId && userId && slots) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/dashboard/user",
      },
    });
  }

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

  // Workshop continuation
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

  // Workshop single occurrence
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
  }

  throw new Response("Missing registration parameters in session metadata", {
    status: 400,
  });
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
