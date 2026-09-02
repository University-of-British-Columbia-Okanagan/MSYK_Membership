// session.server throws at import time if SESSION_SECRET is unset, and the route pulls
// it in transitively — so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import {
  registerMembershipSubscription,
  activateMembershipForm,
  getMembershipPlanById,
} from "~/models/membership.server";
import { getUserById, getOrCreateStripeCustomer } from "~/models/user.server";
import {
  applyMembershipDiscount,
  getCheckoutSessionCouponId,
} from "~/services/stripe-discounts.server";
import { getAdminSetting } from "~/models/admin.server";
import { loader } from "~/routes/dashboard/paymentsuccess";

// The route builds a Stripe client at module load from STRIPE_SECRET_KEY, absent here.
// The factory runs during the imports above, so the retrieve mock has to be created
// inside it and handed back out — a module-scope const would still be in its TDZ.
jest.mock("stripe", () => {
  const retrieve = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({
    checkout: { sessions: { retrieve } },
  }));
  return { __esModule: true, Stripe: ctor, default: ctor, __retrieve: retrieve };
});

const sessionsRetrieveMock = (require("stripe") as { __retrieve: jest.Mock })
  .__retrieve;

jest.mock("~/models/membership.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/equipment.server");
jest.mock("~/models/user.server");
jest.mock("~/models/admin.server");
jest.mock("~/services/stripe-discounts.server");
// Automocking leaves these undefined at call time; the loader wraps the email step in
// its own try/catch, so give them no-ops to keep that path quiet and out of the way.
jest.mock("~/utils/email.server", () => ({
  sendWorkshopConfirmationEmail: jest.fn(),
  sendEquipmentConfirmationEmail: jest.fn(),
  sendMembershipConfirmationEmail: jest.fn(),
  checkPaymentMethodStatus: jest.fn().mockResolvedValue({ hasPaymentMethod: true }),
}));
jest.mock("~/logging/logger");

const mockRegisterSubscription = registerMembershipSubscription as jest.Mock;
const mockActivateForm = activateMembershipForm as jest.Mock;
const mockGetPlan = getMembershipPlanById as jest.Mock;
const mockGetUserById = getUserById as jest.Mock;
const mockGetOrCreateCustomer = getOrCreateStripeCustomer as jest.Mock;
const mockApplyDiscount = applyMembershipDiscount as jest.Mock;
const mockGetSessionCoupon = getCheckoutSessionCouponId as jest.Mock;
const mockGetAdminSetting = getAdminSetting as jest.Mock;

const SESSION_ID = "cs_test_123";

const runLoader = () =>
  loader({
    request: new Request(
      `http://localhost/dashboard/payment/success?session_id=${SESSION_ID}`
    ),
  });

/**
 * The membership branch of the success loader is where a promotion code entered at
 * Stripe Checkout gets pinned to the member's Stripe customer. Without that step the
 * discount dies with the checkout session — which is the bug this whole feature exists
 * to fix — so it is asserted here rather than left to manual browser checks.
 */
describe("paymentsuccess loader - membership discount capture", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // The loader logs and swallows on the discount and email paths by design.
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    sessionsRetrieveMock.mockResolvedValue({
      payment_intent: "pi_1",
      metadata: { membershipPlanId: "1", userId: "4", billingCycle: "monthly" },
    });
    mockRegisterSubscription.mockResolvedValue({ id: 55 });
    mockActivateForm.mockResolvedValue(undefined);
    mockGetPlan.mockResolvedValue({
      id: 1,
      title: "Makerspace Member",
      price: 50,
    });
    mockGetUserById.mockResolvedValue({ id: 4, email: "member@example.com" });
    mockGetOrCreateCustomer.mockResolvedValue("cus_1");
    mockGetSessionCoupon.mockResolvedValue("co_1");
    mockApplyDiscount.mockResolvedValue({
      couponId: "co_1",
      endsAt: new Date("2027-02-26T00:00:00Z"),
    });
    mockGetAdminSetting.mockResolvedValue("5");
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("pins the coupon from the checkout session onto the member's Stripe customer", async () => {
    await runLoader();

    expect(mockGetSessionCoupon).toHaveBeenCalledWith(SESSION_ID);
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(4);
    // Bound to the subscription just created, so the mirrored columns land on the right row.
    expect(mockApplyDiscount).toHaveBeenCalledWith("cus_1", "co_1", 55);
  });

  it("captures the discount only after the subscription exists", async () => {
    const order: string[] = [];
    mockRegisterSubscription.mockImplementation(async () => {
      order.push("register");
      return { id: 55 };
    });
    mockApplyDiscount.mockImplementation(async () => {
      order.push("applyDiscount");
      return { couponId: "co_1", endsAt: null };
    });

    await runLoader();

    expect(order).toEqual(["register", "applyDiscount"]);
  });

  it("does not touch the customer when no promotion code was used", async () => {
    mockGetSessionCoupon.mockResolvedValue(null);

    await runLoader();

    expect(mockApplyDiscount).not.toHaveBeenCalled();
    expect(mockGetOrCreateCustomer).not.toHaveBeenCalled();
  });

  // The membership is already paid for by this point. A discount that cannot be stored
  // must not cost the member their subscription.
  it("still completes the subscription when capturing the discount throws", async () => {
    mockGetSessionCoupon.mockRejectedValue(new Error("stripe down"));

    await expect(runLoader()).resolves.toBeDefined();

    expect(mockRegisterSubscription).toHaveBeenCalled();
    expect(mockActivateForm).toHaveBeenCalled();
  });

  it("survives applyMembershipDiscount reporting failure", async () => {
    mockApplyDiscount.mockResolvedValue(null);

    await expect(runLoader()).resolves.toBeDefined();

    expect(mockActivateForm).toHaveBeenCalled();
  });
});
