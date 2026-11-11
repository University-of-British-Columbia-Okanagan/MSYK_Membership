jest.mock("~/utils/session.server", () => ({ getUser: jest.fn() }));
jest.mock("~/models/membership.server", () => ({
  registerMembershipSubscription: jest.fn(),
  getMembershipPlanById: jest.fn(),
  getOwnedMembership: jest.fn(),
  MembershipChangeError: class MembershipChangeError extends Error {},
  MEMBERSHIP_REVOKED_ERROR: "MEMBERSHIP_REVOKED",
}));
jest.mock("~/utils/email.server", () => ({
  sendMembershipResubscribeEmail: jest.fn(),
  checkPaymentMethodStatus: jest.fn(),
}));
jest.mock("~/logging/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { getUser } from "~/utils/session.server";
import {
  getMembershipPlanById,
  getOwnedMembership,
  registerMembershipSubscription,
} from "~/models/membership.server";
import { checkPaymentMethodStatus, sendMembershipResubscribeEmail } from "~/utils/email.server";
import { action } from "~/routes/api/paymentresubscribe";

const PLAN = { id: 2, title: "Makerspace Member", price: 50, price3Months: 140, price6Months: 270, priceYearly: 500 };

function resubscribe() {
  return action({
    request: new Request("http://localhost/dashboard/paymentresubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentMembershipId: "9", membershipPlanId: 2, userId: "5", autoRenew: true }),
    }),
  });
}

describe("resubscribe confirmation email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: 5, email: "member@example.com" });
    (getMembershipPlanById as jest.Mock).mockResolvedValue(PLAN);
    (checkPaymentMethodStatus as jest.Mock).mockResolvedValue(false);
  });

  it.each([
    ["monthly", 50, "2026-12-10T06:00:00.000Z"],
    ["quarterly", 140, "2027-02-10T06:00:00.000Z"],
    ["semiannually", 270, "2027-05-10T06:00:00.000Z"],
    ["yearly", 500, "2027-11-10T06:00:00.000Z"],
  ])("quotes the %s next billing date that was actually saved", async (cycle, price, saved) => {
    // The member's own cancelled membership, read through the owner-checked lookup.
    (getOwnedMembership as jest.Mock).mockResolvedValue({
      id: 9,
      userId: 5,
      membershipPlanId: 2,
      status: "cancelled",
      billingCycle: cycle,
    });
    (registerMembershipSubscription as jest.Mock).mockResolvedValue({ id: 9, nextPaymentDate: new Date(saved) });

    await resubscribe();

    expect(sendMembershipResubscribeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: cycle, planPrice: price, nextBillingDate: new Date(saved) })
    );
  });
});
