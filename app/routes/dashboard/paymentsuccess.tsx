import { useLoaderData, useNavigate } from "react-router-dom";
import { Stripe } from "stripe";
import {
  registerForWorkshop,
  registerUserForAllOccurrences,
} from "../../models/workshop.server";
import { registerMembershipSubscription } from "../../models/membership.server";
import { useState, useEffect } from "react";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const isDowngrade = url.searchParams.get("downgrade") === "true";
  const isResubscribe = url.searchParams.get("resubscribe") === "true";
  const isQuickCheckout = url.searchParams.get("quick_checkout") === "true";
  const checkoutType = url.searchParams.get("type");

  if (isQuickCheckout && checkoutType) {
    let message = "🎉 Payment successful!";
    let redirectPath = "/dashboard";

    switch (checkoutType) {
      case "workshop":
        message =
          "🎉 Workshop registration successful! A confirmation email has been sent.";
        redirectPath = "/dashboard/workshops";
        break;
      case "equipment":
        message =
          "🎉 Equipment payment successful! Your booking slots will be processed.";
        redirectPath = "/dashboard/equipments";

        // For equipment quick checkout, we need to handle the booking
        const equipmentId = url.searchParams.get("equipment_id");
        const slotsDataKey = url.searchParams.get("slots_data_key");

        if (equipmentId && slotsDataKey) {
          return new Response(
            JSON.stringify({
              success: true,
              isQuickCheckout: true,
              isEquipment: true,
              checkoutType,
              redirectPath,
              message,
              equipmentId: parseInt(equipmentId),
              slotsDataKey: slotsDataKey,
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        break;
      case "membership":
        message =
          "🎉 Membership subscription successful! A confirmation email has been sent.";
        redirectPath = "/dashboard/memberships";
        break;
    }

    return new Response(
      JSON.stringify({
        success: true,
        isQuickCheckout: true,
        checkoutType,
        redirectPath,
        message,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

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
    equipmentId,
    slotsDataKey,
    isEquipmentBooking,
  } = metadata;

  if (equipmentId && userId && isEquipmentBooking === "true") {
    return new Response(
      JSON.stringify({
        success: true,
        isEquipment: true,
        slotsDataKey: slotsDataKey,
        equipmentId: parseInt(equipmentId),
        message:
          "🎉 Equipment payment successful! Your booking slots will be processed.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Membership branch
  if (membershipPlanId) {
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

  // Multi-day workshop
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
          message: "Registration (multi-day) failed: " + error.message,
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
    isQuickCheckout?: boolean;
    checkoutType?: string;
    redirectPath?: string;
    message: string;
    slotsDataKey?: string;
    equipmentId?: number;
  };
  const navigate = useNavigate();
  const [bookingStatus, setBookingStatus] = useState<string>("");

  // Handle equipment booking after payment success
  useEffect(() => {
    if (data.isEquipment && data.slotsDataKey && data.equipmentId) {
      const processEquipmentBooking = async () => {
        try {
          setBookingStatus("Processing your equipment booking...");

          // Get slots from sessionStorage
          const slotsData = sessionStorage.getItem(data.slotsDataKey!);
          if (!slotsData) {
            setBookingStatus("Booking data not found. Please contact support.");
            return;
          }

          const slots = JSON.parse(slotsData);

          // Book each slot by making individual requests to the equipment booking endpoint
          for (const slotString of slots) {
            const [startTime, endTime] = slotString.split("|");

            // Make a request to book each slot
            const response = await fetch("/dashboard/equipments/book-slot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                equipmentId: data.equipmentId,
                startTime,
                endTime,
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to book slot: ${startTime}`);
            }
          }

          // Clean up sessionStorage
          sessionStorage.removeItem(data.slotsDataKey!);
          setBookingStatus("✅ All equipment slots booked successfully!");
        } catch (error: any) {
          console.error("Equipment booking error:", error);
          setBookingStatus(
            `❌ Booking failed: ${error.message}. Please contact support.`
          );
        }
      };

      processEquipmentBooking();
    }
  }, [data.isEquipment, data.slotsDataKey, data.equipmentId]);

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">
        {data.success ? "Payment Successful!" : "Payment Failed"}
      </h2>
      <p>{data.message}</p>

      {data.isEquipment && bookingStatus && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-700">{bookingStatus}</p>
        </div>
      )}

      <button
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() => {
          if (data.isQuickCheckout && data.redirectPath) {
            navigate(data.redirectPath);
          } else if (data.isEquipment) {
            navigate("/dashboard/equipments");
          } else if (data.isMembership) {
            navigate("/dashboard/memberships");
          } else {
            navigate("/dashboard/workshops");
          }
        }}
      >
        {data.isQuickCheckout
          ? `Back to ${data.checkoutType}s`
          : data.isEquipment
          ? "Back to Equipment"
          : data.isMembership
          ? "Back to Memberships"
          : "Back to Workshops"}
      </button>
    </div>
  );
}
