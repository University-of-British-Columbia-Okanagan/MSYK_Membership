import { useLoaderData, useNavigate } from "react-router-dom";
import { Stripe } from "stripe";
import {
  registerForWorkshop,
  registerUserForAllOccurrences,
} from "../../models/workshop.server";
import { registerMembershipSubscription } from "../../models/membership.server";
import { saveUserMembershipPayment } from "../../models/user.server";
import { bookEquipment } from "../../models/equipment.server";

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
    apiVersion: "2025-02-24.acacia",
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

  if (equipmentId && userId && slots) {
    try {
      // Parse the slots JSON string
      const slotArray = JSON.parse(slots);

      // Process each slot booking
      for (const entry of slotArray) {
        const [startTime, endTime] = entry.split("|");

        // Create a fake request to pass to bookEquipment
        const fakeRequest = new Request("http://localhost", {
          headers: {
            Cookie: request.headers.get("Cookie") || "", // Pass the session cookie
          },
        });

        // Now book the equipment
        await bookEquipment(
          fakeRequest,
          parseInt(equipmentId),
          startTime,
          endTime
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          isEquipment: true,
          message:
            "🎉 Equipment booking successful! You can now use the equipment during your booked time slots.",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("Equipment booking error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          isEquipment: true,
          message: "Equipment booking failed: " + error.message,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Membership branch
  if (membershipPlanId) {
    // 1) Retrieve the Checkout Session and expand into its PaymentIntent & PaymentMethod
    const sessionWithPM = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method"],
    });
    const pi = sessionWithPM.payment_intent as Stripe.PaymentIntent;
    if (!pi || typeof pi.payment_method === "string") {
      throw new Error("Missing expanded payment method");
    }
    const pm = pi.payment_method as Stripe.PaymentMethod;

    // Attempt to get the Customer ID Stripe created for us.
    // If it’s null, we build one ourselves from the session’s customer_details.
    let stripeCustomerId: string;
    if (typeof session.customer === "string" && session.customer) {
      stripeCustomerId = session.customer;
    } else {
      // session.customer_details is guaranteed by Checkout when you pass customer_email
      const details = session.customer_details!;
      const newCust = await stripe.customers.create({
        email: details.email || undefined,
        name: details.name || undefined,
        address: details.address
          ? {
              line1: details.address.line1 || undefined,
              line2: details.address.line2 || undefined,
              city: details.address.city || undefined,
              postal_code: details.address.postal_code || undefined,
              country: details.address.country || undefined,
            }
          : undefined,
      });
      stripeCustomerId = newCust.id;
    }
    // Now you have a Customer ID no matter what:
    console.log("Using Stripe Customer:", stripeCustomerId);

    // 4) Persist the hashed card + billing details and Stripe IDs
    await saveUserMembershipPayment({
      userId: parseInt(metadata.userId!),
      membershipPlanId: parseInt(metadata.membershipPlanId!),
      email: pm.billing_details.email || "",
      cardNumber: `****${pm.card?.last4}`, // only last4
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      cvc: "", // never returned
      cardholderName: pm.billing_details.name || "",
      region: pm.billing_details.address?.country || "",
      postalCode: pm.billing_details.address?.postal_code || "",
      stripeCustomerId, // saved above
      stripePaymentMethodId: pm.id,
    });

    try {
      const currentMembershipId = metadata.currentMembershipId
        ? parseInt(metadata.currentMembershipId)
        : null;

      await registerMembershipSubscription(
        parseInt(userId),
        parseInt(membershipPlanId),
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
    isEquipment?: boolean;
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
        onClick={() => {
          if (data.isEquipment) {
            navigate("/dashboard/equipments");
          } else if (data.isMembership) {
            navigate("/dashboard/memberships");
          } else {
            navigate("/dashboard/workshops");
          }
        }}
      >
        {data.isEquipment
          ? "Back to Equipment"
          : data.isMembership
          ? "Back to Memberships"
          : "Back to Workshops"}
      </button>
    </div>
  );
}
