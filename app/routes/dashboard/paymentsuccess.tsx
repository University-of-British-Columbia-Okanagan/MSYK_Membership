import { redirect, useLoaderData, useNavigate } from "react-router-dom";
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
import {
  getMembershipPlanById,
  registerMembershipSubscription,
  activateMembershipForm,
  MEMBERSHIP_REVOKED_ERROR,
} from "../../models/membership.server";
import {
  sendWorkshopConfirmationEmail,
  sendMembershipConfirmationEmail,
  checkPaymentMethodStatus,
} from "~/utils/email.server";
import { getOrCreateStripeCustomer } from "~/models/user.server";
import {
  applyMembershipDiscount,
  getCheckoutSessionCouponId,
} from "~/services/stripe-discounts.server";
import {
  EquipmentBookingError,
  fulfilEquipmentCheckout,
} from "~/models/equipment.server";
import {
  claimPaymentFulfillment,
  releasePaymentFulfillment,
  type FulfillmentKind,
} from "~/models/payment.server";
import { getAdminSetting } from "~/models/admin.server";
import { getUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { addBusinessMonths, toBusinessDateInput } from "~/utils/business-time";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const MEMBERSHIP_SUCCESS =
  "🎉 Membership subscription successful! A confirmation email has been sent.";
const MULTI_DAY_SUCCESS =
  "🎉 Registration successful for all occurrences! A confirmation email has been sent.";
const SINGLE_SUCCESS = "🎉 Registration successful! A confirmation email has been sent.";
const EQUIPMENT_SUCCESS =
  "🎉 Equipment payment successful! Your booking slots will be processed.";
const EQUIPMENT_BOOKED = "✅ All equipment slots booked successfully!";

/** What the page shows, and whether the payment was turned into what it bought. */
type Outcome = { completed: boolean; body: Record<string, unknown>; status?: number };

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const user = await getUser(request);
  if (!user) {
    throw redirect(`/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const isDowngrade = url.searchParams.get("downgrade") === "true";
  const isResubscribe = url.searchParams.get("resubscribe") === "true";
  const isQuickCheckout = url.searchParams.get("quick_checkout") === "true";
  const checkoutType = url.searchParams.get("type");
  const isFree = url.searchParams.get("free") === "1";

  // Quick checkout, free registration, downgrade and resubscribe have already been
  // completed on the server by the time the browser lands here; these only confirm it.
  if (isQuickCheckout && checkoutType) {
    let message = isFree ? "🎉 Registration successful!" : "🎉 Payment successful!";
    let redirectPath = "/dashboard";

    switch (checkoutType) {
      case "workshop":
        message = "🎉 Workshop registration successful! A confirmation email has been sent.";
        redirectPath = "/dashboard/workshops";
        break;
      case "equipment":
        message = isFree
          ? "🎉 Equipment booking successful! Your booking slots will be processed."
          : EQUIPMENT_SUCCESS;
        redirectPath = "/dashboard/equipments";
        break;
      case "membership":
        message = MEMBERSHIP_SUCCESS;
        redirectPath = "/dashboard/memberships";
        break;
    }

    return json({ success: true, isQuickCheckout: true, checkoutType, redirectPath, message });
  }

  if (isDowngrade) {
    return json({
      success: true,
      isMembership: true,
      message:
        "🎉 Membership downgrade scheduled! Your downgraded plan will begin at the end of your current billing cycle. You'll continue to enjoy your current benefits until then. A confirmation email has been sent.",
    });
  }
  if (isResubscribe) {
    return json({
      success: true,
      isMembership: true,
      message:
        "🎉 Membership reactivated! Your membership has been successfully reactivated. You'll continue to enjoy your membership benefits. A confirmation email has been sent.",
    });
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

  // A 100%-off promotion code completes the session with nothing to pay. The amount
  // was set by the server, so only a Stripe-applied discount can make it zero.
  const settled =
    session.payment_status === "paid" ||
    (session.payment_status === "no_payment_required" && session.status === "complete");
  if (!settled) {
    return json({
      success: false,
      message: "This payment has not been completed, so nothing was registered or booked.",
    });
  }
  if (metadata.userId !== String(user.id)) {
    logger.warn(`User ${user.id} opened checkout session ${sessionId} paid by user ${metadata.userId}`, {
      url: request.url,
    });
    return json(
      {
        success: false,
        message: "This payment belongs to a different account. Please sign in with the account that paid.",
      },
      403
    );
  }

  const paymentIntentId = session.payment_intent as string;
  const { workshopId, occurrenceId, connectId, membershipPlanId, isEquipmentBooking } = metadata;
  const variationId = metadata.variationId ? parseInt(metadata.variationId) : null;

  let kind: FulfillmentKind;
  let alreadyDone: Record<string, unknown>;
  let fulfil: () => Promise<Outcome>;

  if (isEquipmentBooking === "true") {
    kind = "equipment";
    alreadyDone = { success: true, isEquipment: true, message: EQUIPMENT_SUCCESS, bookingStatus: EQUIPMENT_BOOKED };
    fulfil = () => fulfilEquipment(metadata.equipmentCheckoutId, user.id, paymentIntentId);
  } else if (membershipPlanId) {
    kind = "membership";
    alreadyDone = { success: true, isMembership: true, message: MEMBERSHIP_SUCCESS };
    fulfil = () =>
      fulfilMembership(sessionId, user, parseInt(membershipPlanId), metadata, paymentIntentId);
  } else if (workshopId && connectId) {
    kind = "workshop";
    alreadyDone = { success: true, isMembership: false, message: MULTI_DAY_SUCCESS };
    fulfil = () =>
      fulfilMultiDay(user, parseInt(workshopId), parseInt(connectId), variationId, paymentIntentId);
  } else if (workshopId && occurrenceId) {
    kind = "workshop";
    alreadyDone = { success: true, isMembership: false, message: SINGLE_SUCCESS };
    fulfil = () =>
      fulfilSingle(user, parseInt(workshopId), parseInt(occurrenceId), variationId, paymentIntentId);
  } else {
    throw new Response("Missing registration parameters in session metadata", {
      status: 400,
    });
  }

  // At most once per Checkout Session: a reload finds the claim and only confirms.
  if (!(await claimPaymentFulfillment(sessionId, user.id, kind))) {
    return json(alreadyDone);
  }

  let outcome: Outcome;
  try {
    outcome = await fulfil();
  } catch (error) {
    outcome = {
      completed: false,
      body: { success: false, message: "We could not complete your purchase. Please contact support." },
    };
    logger.error(`Fulfilment of ${sessionId} threw: ${error}`, { url: request.url });
  }

  // Not fulfilled, so not recorded: reloading the page retries it.
  if (!outcome.completed) {
    await releasePaymentFulfillment(sessionId);
    logger.error(`Paid checkout session ${sessionId} for user ${user.id} was not fulfilled`, {
      url: request.url,
    });
  }
  return json(outcome.body, outcome.status);
}

type SessionUser = { id: number; email: string };

async function fulfilEquipment(
  checkoutId: string | undefined,
  userId: number,
  paymentIntentId: string
): Promise<Outcome> {
  const failed = (reason: string): Outcome => ({
    completed: false,
    body: {
      success: true,
      isEquipment: true,
      message: EQUIPMENT_SUCCESS,
      bookingStatus: `❌ Booking failed: ${reason.replace(/\.$/, "")}. Please contact support.`,
    },
  });
  if (!checkoutId) return failed("Booking details not found");
  try {
    await fulfilEquipmentCheckout(checkoutId, userId, paymentIntentId);
  } catch (error) {
    return failed(
      error instanceof EquipmentBookingError ? error.message : "Your slots could not be booked"
    );
  }
  return {
    completed: true,
    body: { success: true, isEquipment: true, message: EQUIPMENT_SUCCESS, bookingStatus: EQUIPMENT_BOOKED },
  };
}

async function fulfilMembership(
  sessionId: string,
  user: SessionUser,
  membershipPlanId: number,
  metadata: Record<string, string>,
  paymentIntentId: string
): Promise<Outcome> {
  const currentMembershipId = metadata.currentMembershipId
    ? parseInt(metadata.currentMembershipId)
    : null;
  const billingCycle =
    (metadata.billingCycle as "monthly" | "quarterly" | "semiannually" | "yearly") || "monthly";
  const autoRenew =
    metadata.autoRenew === undefined
      ? true
      : metadata.autoRenew !== "false" && metadata.autoRenew !== "0";

  let subscription;
  try {
    subscription = await registerMembershipSubscription(
      user.id,
      membershipPlanId,
      currentMembershipId,
      false, // Not a downgrade
      false, // Not a resubscription
      paymentIntentId,
      billingCycle,
      autoRenew
    );
  } catch (error) {
    if (error instanceof Error && error.message === MEMBERSHIP_REVOKED_ERROR) {
      return {
        completed: false,
        status: 403,
        body: {
          success: false,
          isMembership: true,
          message:
            "Payment succeeded but this account's membership access is revoked. Please contact support.",
        },
      };
    }
    logger.error(`Membership registration error: ${error}`);
    return {
      completed: false,
      body: { success: false, message: "Failed to process membership" },
    };
  }

  // The membership exists now. Nothing below may fail the page, or a reload would
  // retry and create a second one.
  try {
    await activateMembershipForm(user.id, membershipPlanId, subscription.id);
  } catch (error) {
    console.error("Failed to activate membership form:", error);
  }

  // Pin any promotion code the member entered onto their Stripe Customer, so the
  // renewal invoices inherit it. Without this the discount dies with this session.
  try {
    const couponId = await getCheckoutSessionCouponId(sessionId);
    if (couponId) {
      const customerId = await getOrCreateStripeCustomer(user.id);
      const applied = await applyMembershipDiscount(customerId, couponId, subscription.id);
      console.log(
        `Applied recurring discount ${couponId} to user ${user.id}` +
          (applied?.endsAt ? `, ends ${toBusinessDateInput(applied.endsAt)}` : " (no expiry)")
      );
    }
  } catch (discountErr) {
    console.error(`Failed to carry the checkout discount forward for user ${user.id}:`, discountErr);
  }

  try {
    const membershipPlan = await getMembershipPlanById(membershipPlanId);
    if (membershipPlan) {
      const nextBillingDate = addBusinessMonths(
        new Date(),
        billingCycle === "semiannually" ? 6 : billingCycle === "quarterly" ? 3 : billingCycle === "yearly" ? 12 : 1
      );
      const needsPaymentMethod = await checkPaymentMethodStatus(user.id);
      const gstSetting = await getAdminSetting("gst_percentage", "5");
      await sendMembershipConfirmationEmail({
        userEmail: user.email,
        planTitle: membershipPlan.title,
        planDescription: membershipPlan.description,
        monthlyPrice: membershipPlan.price,
        features: membershipPlan.feature as Record<string, string>,
        needAdminPermission: membershipPlan.needAdminPermission,
        billingCycle,
        planPrice:
          billingCycle === "quarterly"
            ? membershipPlan.price3Months ?? membershipPlan.price
            : billingCycle === "semiannually"
            ? membershipPlan.price6Months ?? membershipPlan.price
            : billingCycle === "yearly"
            ? membershipPlan.priceYearly ?? membershipPlan.price
            : membershipPlan.price,
        nextBillingDate: billingCycle === "monthly" ? nextBillingDate : undefined,
        needsPaymentMethod,
        autoRenew,
        gstPercentage: parseFloat(gstSetting),
      });
    }
  } catch (emailConfirmationFailedError) {
    console.error("Email confirmation failed:", emailConfirmationFailedError);
  }

  return { completed: true, body: { success: true, isMembership: true, message: MEMBERSHIP_SUCCESS } };
}

const workshopFailure = (message: string): Outcome => ({
  completed: false,
  body: { success: false, isMembership: false, message },
});

async function fulfilMultiDay(
  user: SessionUser,
  workshopId: number,
  connectId: number,
  variationId: number | null,
  paymentIntentId: string
): Promise<Outcome> {
  try {
    const workshop = await getWorkshopById(workshopId);
    const occurrences = await getWorkshopOccurrencesByConnectId(workshopId, connectId);

    if (!workshop || !occurrences || occurrences.length === 0) {
      return workshopFailure("Workshop or occurrences not found");
    }
    if (occurrences.some((occ) => occ.status === "cancelled")) {
      return workshopFailure("Workshop has been cancelled");
    }
    const now = new Date();
    if (occurrences.some((occ) => new Date(occ.endDate) < now)) {
      return workshopFailure("Workshop time has passed");
    }
    const capacityCheck = await checkMultiDayWorkshopCapacity(workshopId, connectId, variationId);
    if (!capacityCheck.hasCapacity) {
      return workshopFailure("Workshop is full");
    }

    await registerUserForAllOccurrences(workshopId, connectId, user.id, variationId, paymentIntentId);

    try {
      const priceVariation = variationId ? await getWorkshopPriceVariation(variationId) : null;
      await sendWorkshopConfirmationEmail({
        userEmail: user.email,
        workshopName: workshop.name,
        sessions: occurrences.map((occ) => ({ startDate: occ.startDate, endDate: occ.endDate })),
        location: workshop.location,
        basePrice: workshop.price,
        priceVariation: priceVariation
          ? {
              name: priceVariation.name,
              description: priceVariation.description,
              price: priceVariation.price,
            }
          : null,
      });
    } catch (emailConfirmationFailedError) {
      console.error("Email confirmation failed:", emailConfirmationFailedError);
    }

    return { completed: true, body: { success: true, isMembership: false, message: MULTI_DAY_SUCCESS } };
  } catch (error: any) {
    return workshopFailure("Registration (multi-day) failed: " + error.message);
  }
}

async function fulfilSingle(
  user: SessionUser,
  workshopId: number,
  occurrenceId: number,
  variationId: number | null,
  paymentIntentId: string
): Promise<Outcome> {
  try {
    const workshop = await getWorkshopById(workshopId);
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);

    if (!workshop || !occurrence) {
      return workshopFailure("Workshop or occurrence not found");
    }
    if (occurrence.status === "cancelled") {
      return workshopFailure("Workshop has been cancelled");
    }
    if (new Date(occurrence.endDate) < new Date()) {
      return workshopFailure("Workshop time has passed");
    }
    const capacityCheck = await checkWorkshopCapacity(workshopId, occurrenceId, variationId);
    if (!capacityCheck.hasCapacity) {
      return workshopFailure("Workshop is full");
    }

    await registerForWorkshop(workshopId, occurrenceId, user.id, variationId, paymentIntentId);

    try {
      const priceVariation = variationId ? await getWorkshopPriceVariation(variationId) : null;
      await sendWorkshopConfirmationEmail({
        userEmail: user.email,
        workshopName: workshop.name,
        startDate: occurrence.startDate,
        endDate: occurrence.endDate,
        location: workshop.location,
        basePrice: workshop.price,
        priceVariation: priceVariation
          ? {
              name: priceVariation.name,
              description: priceVariation.description,
              price: priceVariation.price,
            }
          : null,
      });
    } catch (emailConfirmationFailedError) {
      console.error("Email confirmation failed:", emailConfirmationFailedError);
    }

    return { completed: true, body: { success: true, isMembership: false, message: SINGLE_SUCCESS } };
  } catch (error: any) {
    return workshopFailure("Registration failed: " + error.message);
  }
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
    bookingStatus?: string;
  };
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">
        {data.success ? "Payment Successful!" : "Payment Failed"}
      </h2>
      <p>{data.message}</p>

      {data.isEquipment && data.bookingStatus && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-700">{data.bookingStatus}</p>
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
