// session.server throws at import time if SESSION_SECRET is unset, and the route pulls
// it in transitively, so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import { getUser } from "~/utils/session.server";
import {
  activateMembershipForm,
  registerMembershipSubscription,
  getMembershipPlanById,
} from "~/models/membership.server";
import {
  checkWorkshopCapacity,
  getWorkshopById,
  getWorkshopOccurrence,
  registerForWorkshop,
} from "~/models/workshop.server";
import { fulfilEquipmentCheckout } from "~/models/equipment.server";
import { claimPaymentFulfillment, releasePaymentFulfillment } from "~/models/payment.server";
import { getCheckoutSessionCouponId } from "~/services/stripe-discounts.server";
import { getAdminSetting } from "~/models/admin.server";
import { loader } from "~/routes/dashboard/paymentsuccess";

jest.mock("stripe", () => {
  const retrieve = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({ checkout: { sessions: { retrieve } } }));
  return { __esModule: true, Stripe: ctor, default: ctor, __retrieve: retrieve };
});
const retrieveMock = (require("stripe") as { __retrieve: jest.Mock }).__retrieve;

jest.mock("~/utils/session.server", () => ({ getUser: jest.fn() }));
jest.mock("~/models/membership.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/user.server");
jest.mock("~/models/admin.server");
jest.mock("~/services/stripe-discounts.server");
jest.mock("~/models/equipment.server", () => {
  class EquipmentBookingError extends Error {}
  return { fulfilEquipmentCheckout: jest.fn(), EquipmentBookingError };
});
jest.mock("~/models/payment.server", () => ({
  claimPaymentFulfillment: jest.fn(),
  releasePaymentFulfillment: jest.fn(),
}));
jest.mock("~/utils/email.server", () => ({
  sendWorkshopConfirmationEmail: jest.fn(),
  sendMembershipConfirmationEmail: jest.fn(),
  checkPaymentMethodStatus: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/logging/logger");

const SESSION_ID = "cs_test_9";
const MEMBER = { id: 4, email: "member@example.com", roleLevel: 3 };
const DAY = 24 * 60 * 60 * 1000;

const load = (query = `session_id=${SESSION_ID}`) =>
  loader({ request: new Request(`http://localhost/dashboard/payment/success?${query}`) });

const body = async (result: unknown) => (result as Response).json();

const paidSession = (metadata: Record<string, string>, overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  payment_status: "paid",
  payment_intent: "pi_77",
  metadata,
  ...overrides,
});

const MEMBERSHIP_META = { membershipPlanId: "2", userId: "4", billingCycle: "monthly", autoRenew: "true" };

describe("paymentsuccess loader - verifies the payment before fulfilling it once", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    (getUser as jest.Mock).mockResolvedValue(MEMBER);
    (claimPaymentFulfillment as jest.Mock).mockResolvedValue(true);
    (releasePaymentFulfillment as jest.Mock).mockResolvedValue(undefined);
    (registerMembershipSubscription as jest.Mock).mockResolvedValue({ id: 55 });
    (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 2, title: "Member", price: 50 });
    (getCheckoutSessionCouponId as jest.Mock).mockResolvedValue(null);
    (getAdminSetting as jest.Mock).mockResolvedValue("5");
    (getWorkshopById as jest.Mock).mockResolvedValue({ id: 1, name: "Laser", price: 30, location: "YK" });
    (getWorkshopOccurrence as jest.Mock).mockResolvedValue({
      id: 10,
      status: "active",
      startDate: new Date(Date.now() + DAY),
      endDate: new Date(Date.now() + DAY + 1),
    });
    (checkWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: true });
  });

  afterEach(() => consoleError.mockRestore());

  it("sends a signed-out visitor to log in and back, touching nothing", async () => {
    (getUser as jest.Mock).mockResolvedValue(null);

    let thrown: unknown;
    try {
      await load();
    } catch (e) {
      thrown = e;
    }

    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("Location")).toBe(
      `/login?redirect=${encodeURIComponent(`/dashboard/payment/success?session_id=${SESSION_ID}`)}`
    );
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(registerMembershipSubscription).not.toHaveBeenCalled();
  });

  it("fulfils nothing for a session Stripe has not been paid for", async () => {
    retrieveMock.mockResolvedValue(paidSession(MEMBERSHIP_META, { payment_status: "unpaid" }));

    const data = await body(await load());

    expect(data.success).toBe(false);
    expect(claimPaymentFulfillment).not.toHaveBeenCalled();
    expect(registerMembershipSubscription).not.toHaveBeenCalled();
  });

  it("fulfils a completed session that a 100%-off promotion code made free", async () => {
    retrieveMock.mockResolvedValue(
      paidSession(MEMBERSHIP_META, { payment_status: "no_payment_required", status: "complete" })
    );

    await load();

    expect(claimPaymentFulfillment).toHaveBeenCalled();
    expect(registerMembershipSubscription).toHaveBeenCalled();
  });

  it("fulfils nothing for a session still open in Stripe, even when nothing is owed", async () => {
    retrieveMock.mockResolvedValue(
      paidSession(MEMBERSHIP_META, { payment_status: "no_payment_required", status: "open" })
    );

    const data = await body(await load());

    expect(data.success).toBe(false);
    expect(claimPaymentFulfillment).not.toHaveBeenCalled();
  });

  it("fulfils nothing for a payment made by a different account", async () => {
    retrieveMock.mockResolvedValue(paidSession({ ...MEMBERSHIP_META, userId: "9" }));

    const res = (await load()) as Response;

    expect(res.status).toBe(403);
    expect((await res.json()).success).toBe(false);
    expect(claimPaymentFulfillment).not.toHaveBeenCalled();
    expect(registerMembershipSubscription).not.toHaveBeenCalled();
  });

  it("claims the session before creating the membership, for the signed-in member", async () => {
    retrieveMock.mockResolvedValue(paidSession(MEMBERSHIP_META));
    const order: string[] = [];
    (claimPaymentFulfillment as jest.Mock).mockImplementation(async () => (order.push("claim"), true));
    (registerMembershipSubscription as jest.Mock).mockImplementation(async () => (order.push("register"), { id: 55 }));

    const data = await body(await load());

    expect(claimPaymentFulfillment).toHaveBeenCalledWith(SESSION_ID, 4, "membership");
    expect(order).toEqual(["claim", "register"]);
    expect(registerMembershipSubscription).toHaveBeenCalledWith(4, 2, null, false, false, "pi_77", "monthly", true);
    expect(data).toMatchObject({
      success: true,
      message: "🎉 Membership subscription successful! A confirmation email has been sent.",
    });
  });

  it("shows the success message on reload without creating another membership", async () => {
    retrieveMock.mockResolvedValue(paidSession(MEMBERSHIP_META));
    (claimPaymentFulfillment as jest.Mock).mockResolvedValue(false);

    const data = await body(await load());

    expect(registerMembershipSubscription).not.toHaveBeenCalled();
    expect(activateMembershipForm).not.toHaveBeenCalled();
    expect(data).toMatchObject({
      success: true,
      isMembership: true,
      message: "🎉 Membership subscription successful! A confirmation email has been sent.",
    });
  });

  it("releases the claim when fulfilment throws, so a reload can retry", async () => {
    retrieveMock.mockResolvedValue(paidSession(MEMBERSHIP_META));
    (registerMembershipSubscription as jest.Mock).mockRejectedValue(new Error("db down"));

    const data = await body(await load());

    expect(data.success).toBe(false);
    expect(releasePaymentFulfillment).toHaveBeenCalledWith(SESSION_ID);
  });

  it("keeps the claim once the membership exists, even if the form step fails", async () => {
    retrieveMock.mockResolvedValue(paidSession(MEMBERSHIP_META));
    (activateMembershipForm as jest.Mock).mockRejectedValue(new Error("form"));

    const data = await body(await load());

    expect(data.success).toBe(true);
    expect(releasePaymentFulfillment).not.toHaveBeenCalled();
  });

  it("registers the signed-in member for a paid workshop session", async () => {
    retrieveMock.mockResolvedValue(paidSession({ workshopId: "1", occurrenceId: "10", userId: "4", variationId: "" }));

    const data = await body(await load());

    expect(claimPaymentFulfillment).toHaveBeenCalledWith(SESSION_ID, 4, "workshop");
    expect(registerForWorkshop).toHaveBeenCalledWith(1, 10, 4, null, "pi_77");
    expect(data.message).toBe("🎉 Registration successful! A confirmation email has been sent.");
  });

  it("releases the claim when the workshop filled up after payment", async () => {
    retrieveMock.mockResolvedValue(paidSession({ workshopId: "1", occurrenceId: "10", userId: "4" }));
    (checkWorkshopCapacity as jest.Mock).mockResolvedValue({ hasCapacity: false });

    const data = await body(await load());

    expect(data).toMatchObject({ success: false, message: "Workshop is full" });
    expect(registerForWorkshop).not.toHaveBeenCalled();
    expect(releasePaymentFulfillment).toHaveBeenCalledWith(SESSION_ID);
  });

  describe("equipment", () => {
    const EQUIPMENT_META = { equipmentId: "1", equipmentCheckoutId: "chk_1", userId: "4", isEquipmentBooking: "true" };

    it("books the held slots on the server for the signed-in member", async () => {
      retrieveMock.mockResolvedValue(paidSession(EQUIPMENT_META));
      (fulfilEquipmentCheckout as jest.Mock).mockResolvedValue({ count: 2, alreadyFulfilled: false, equipmentId: 1 });

      const data = await body(await load());

      expect(claimPaymentFulfillment).toHaveBeenCalledWith(SESSION_ID, 4, "equipment");
      expect(fulfilEquipmentCheckout).toHaveBeenCalledWith("chk_1", 4, "pi_77");
      expect(data).toEqual({
        success: true,
        isEquipment: true,
        message: "🎉 Equipment payment successful! Your booking slots will be processed.",
        bookingStatus: "✅ All equipment slots booked successfully!",
      });
    });

    it("does not book again on reload", async () => {
      retrieveMock.mockResolvedValue(paidSession(EQUIPMENT_META));
      (claimPaymentFulfillment as jest.Mock).mockResolvedValue(false);

      const data = await body(await load());

      expect(fulfilEquipmentCheckout).not.toHaveBeenCalled();
      expect(data.bookingStatus).toBe("✅ All equipment slots booked successfully!");
    });

    it("reports a booking that failed after payment and releases the claim", async () => {
      const { EquipmentBookingError } = jest.requireMock("~/models/equipment.server");
      retrieveMock.mockResolvedValue(paidSession(EQUIPMENT_META));
      (fulfilEquipmentCheckout as jest.Mock).mockRejectedValue(
        new EquipmentBookingError("That time is already booked or reserved. Please choose another time.")
      );

      const data = await body(await load());

      expect(data.bookingStatus).toBe(
        "❌ Booking failed: That time is already booked or reserved. Please choose another time. Please contact support."
      );
      expect(releasePaymentFulfillment).toHaveBeenCalledWith(SESSION_ID);
    });
  });

  it("quick checkout's equipment confirmation no longer hands the browser booking data", async () => {
    const data = await body(await load("quick_checkout=true&type=equipment&equipment_id=1&slots_data_key=k"));

    expect(data).toEqual({
      success: true,
      isQuickCheckout: true,
      checkoutType: "equipment",
      redirectPath: "/dashboard/equipments",
      message: "🎉 Equipment payment successful! Your booking slots will be processed.",
    });
  });
});
