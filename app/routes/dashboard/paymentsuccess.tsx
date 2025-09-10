import { useLoaderData, useNavigate } from "react-router-dom";
import { Stripe } from "stripe";
import {
  registerForWorkshop,
  registerUserForAllOccurrences,
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  checkWorkshopCapacity,
  checkMultiDayWorkshopCapacity,
  getWorkshopPriceVariation,
} from "../../models/workshop.server";
import { getMembershipPlanById, registerMembershipSubscription } from "../../models/membership.server";
import { useState, useEffect } from "react";
import { sendWorkshopConfirmationEmail, sendEquipmentConfirmationEmail, sendMembershipConfirmationEmail } from "~/utils/email.server";
import { getUserById } from "~/models/user.server";
import { getEquipmentById } from "~/models/equipment.server";

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
        const paymentIntentId = url.searchParams.get("payment_intent_id");

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
              paymentIntentId: paymentIntentId,
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
    variationId,
  } = metadata;

  let user = await getUserById(Number(userId));
  if (!user) {
    return new Response(
        JSON.stringify({
          success: false,
          message: "User not found",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
  }

  if (equipmentId && userId && isEquipmentBooking === "true") {
    const paymentIntentId = session.payment_intent as string;
    return new Response(
      JSON.stringify({
        success: true,
        isEquipment: true,
        slotsDataKey: slotsDataKey,
        equipmentId: parseInt(equipmentId),
        paymentIntentId: paymentIntentId,
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

      const paymentIntentId = session.payment_intent as string;

      await registerMembershipSubscription(
        parseInt(userId),
        parseInt(membershipPlanId),
        currentMembershipId,
        false, // Not a downgrade
        false, // Not a resubscription
        paymentIntentId
      );

      try {
        let membershipPlan = await getMembershipPlanById(Number(membershipPlanId));
        if (membershipPlan) {
          // Calculate next billing date (one month from now)
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

          await sendMembershipConfirmationEmail({
            userEmail: user.email,
            planTitle: membershipPlan.title,
            planDescription: membershipPlan.description,
            monthlyPrice: membershipPlan.price,
            features: membershipPlan.feature as Record<string, string>,
            accessHours: membershipPlan.accessHours as string,
            nextBillingDate,
          });
        }
      } catch (emailConfirmationFailedError) {
        console.error("Email confirmation failed:", emailConfirmationFailedError);
      }

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
      // Get workshop and occurrences to check status and time
      const workshop = await getWorkshopById(parseInt(workshopId));
      const occurrences = await getWorkshopOccurrencesByConnectId(
        parseInt(workshopId),
        parseInt(connectId)
      );

      if (!workshop || !occurrences || occurrences.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop or occurrences not found",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if ANY occurrence is cancelled
      const hasAnyCancelledOccurrence = occurrences.some(
        (occ) => occ.status === "cancelled"
      );
      if (hasAnyCancelledOccurrence) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop has been cancelled",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if ANY occurrence is in the past
      const now = new Date();
      const hasAnyPastOccurrence = occurrences.some(
        (occ) => new Date(occ.endDate) < now
      );
      if (hasAnyPastOccurrence) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop time has passed",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      const variationId = metadata.variationId
        ? parseInt(metadata.variationId)
        : null;

      // Check if workshop is full
      const capacityCheck = await checkMultiDayWorkshopCapacity(
        parseInt(workshopId),
        parseInt(connectId),
        variationId
      );
      if (!capacityCheck.hasCapacity) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop is full",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      const paymentIntentId = session.payment_intent as string;

      await registerUserForAllOccurrences(
        parseInt(workshopId),
        parseInt(connectId),
        parseInt(userId),
        variationId,
        paymentIntentId
      );

      try {
        // Get price variation details if applicable
        let priceVariation = null;
        if (variationId) {
          priceVariation = await getWorkshopPriceVariation(variationId);
        }

        // Prepare sessions data for multi-day workshop
        const sessions = occurrences.map(occ => ({
          startDate: occ.startDate,
          endDate: occ.endDate
        }));

        await sendWorkshopConfirmationEmail({
          userEmail: user.email,
          workshopName: workshop.name,
          sessions,
          basePrice: workshop.price,
          priceVariation: priceVariation ? {
            name: priceVariation.name,
            description: priceVariation.description,
            price: priceVariation.price
          } : null,
        });
      } catch (emailConfirmationFailedError) {
        console.error("Email confirmation failed:", emailConfirmationFailedError);
      }

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
      // Get workshop and occurrence to check status and time
      const workshop = await getWorkshopById(parseInt(workshopId));
      const occurrence = await getWorkshopOccurrence(
        parseInt(workshopId),
        parseInt(occurrenceId)
      );

      if (!workshop || !occurrence) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop or occurrence not found",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if occurrence is cancelled
      if (occurrence.status === "cancelled") {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop has been cancelled",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if occurrence is in the past
      const now = new Date();
      if (new Date(occurrence.endDate) < now) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop time has passed",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      const variationId = metadata.variationId
        ? parseInt(metadata.variationId)
        : null;

      // Check if workshop is full
      const capacityCheck = await checkWorkshopCapacity(
        parseInt(workshopId),
        parseInt(occurrenceId),
        variationId
      );
      if (!capacityCheck.hasCapacity) {
        return new Response(
          JSON.stringify({
            success: false,
            isMembership: false,
            message: "Workshop is full",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      const paymentIntentId = session.payment_intent as string;

      await registerForWorkshop(
        parseInt(workshopId),
        parseInt(occurrenceId),
        parseInt(userId),
        variationId,
        paymentIntentId
      );
      try {
        // Get price variation details if applicable
        let priceVariation = null;
        if (variationId) {
          priceVariation = await getWorkshopPriceVariation(variationId);
        }

        await sendWorkshopConfirmationEmail({
          userEmail: user.email,
          workshopName: workshop.name,
          startDate: occurrence.startDate,
          endDate: occurrence.endDate,
          basePrice: workshop.price,
          priceVariation: priceVariation ? {
            name: priceVariation.name,
            description: priceVariation.description,
            price: priceVariation.price
          } : null,
        });
      } catch (emailConfirmationFailedError) {
        console.error("Email confirmation failed:", emailConfirmationFailedError);
      }
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
    paymentIntentId?: string;
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

          // Use paymentIntentId from data instead of session
          const slots = JSON.parse(slotsData);
          const paymentIntentId = data.paymentIntentId;

          // Send one batch booking request; server will send a single consolidated email
          const response = await fetch("/dashboard/equipments/book-slot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              equipmentId: data.equipmentId,
              slots: slots.map((slotString: string) => {
                const [startTime, endTime] = slotString.split("|");
                return { startTime, endTime };
              }),
              paymentIntentId,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to book equipment slots");
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
