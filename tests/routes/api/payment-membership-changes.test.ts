jest.mock("~/utils/session.server", () => ({ getUser: jest.fn() }));
jest.mock("~/models/membership.server", () => {
  class MembershipChangeError extends Error {}
  return {
    MembershipChangeError,
    registerMembershipSubscription: jest.fn(),
    getMembershipPlanById: jest.fn(),
    getOwnedMembership: jest.fn(),
    calculateProratedUpgradeAmount: jest.fn(),
    activateMembershipForm: jest.fn(),
    MEMBERSHIP_REVOKED_ERROR: "USER_MEMBERSHIP_REVOKED",
  };
});
jest.mock("~/utils/email.server", () => ({
  sendMembershipDowngradeEmail: jest.fn(),
  sendMembershipResubscribeEmail: jest.fn(),
  checkPaymentMethodStatus: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/utils/db.server", () => ({ db: { userMembership: { findUnique: jest.fn(), findFirst: jest.fn() } } }));
jest.mock("~/logging/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { getUser } from "~/utils/session.server";
import {
  MembershipChangeError,
  calculateProratedUpgradeAmount,
  getMembershipPlanById,
  getOwnedMembership,
  registerMembershipSubscription,
} from "~/models/membership.server";
import { action as upgrade } from "~/routes/api/paymentupgrade";
import { action as downgrade } from "~/routes/api/paymentdowngrade";
import { action as resubscribe } from "~/routes/api/paymentresubscribe";

const SESSION_USER = 5;
const post = (handler: typeof upgrade, body: Record<string, unknown>) =>
  handler({
    request: new Request("http://localhost/dashboard/payment/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });

const activeMembership = (planPrice: number, overrides: Record<string, unknown> = {}) => ({
  id: 7,
  userId: SESSION_USER,
  membershipPlanId: 1,
  status: "active",
  billingCycle: "monthly",
  nextPaymentDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  membershipPlan: { id: 1, title: "Current", price: planPrice },
  ...overrides,
});

const NOT_YOURS = "That membership could not be found on your account.";

describe("membership change routes act for the signed-in member only", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: SESSION_USER, email: "member@example.com" });
    (registerMembershipSubscription as jest.Mock).mockResolvedValue({ id: 40, nextPaymentDate: new Date() });
    (calculateProratedUpgradeAmount as jest.Mock).mockReturnValue(0);
  });

  describe("upgrade (no payment due)", () => {
    beforeEach(() => {
      (getOwnedMembership as jest.Mock).mockResolvedValue(activeMembership(50));
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 2, title: "Same Price", price: 50 });
    });

    it("upgrades the session member's own active membership, ignoring body.userId", async () => {
      const res = await post(upgrade, { currentMembershipId: 7, newMembershipPlanId: 2, userId: 99 });

      expect(res.status).toBe(200);
      expect(getOwnedMembership).toHaveBeenCalledWith(SESSION_USER, 7, "active");
      expect(registerMembershipSubscription).toHaveBeenCalledWith(
        SESSION_USER, 2, 7, false, false, undefined, "monthly", true
      );
    });

    it("refuses a membership that is not the member's own active one", async () => {
      (getOwnedMembership as jest.Mock).mockRejectedValue(new MembershipChangeError(NOT_YOURS));

      const res = await post(upgrade, { currentMembershipId: 77, newMembershipPlanId: 2 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: NOT_YOURS });
      expect(registerMembershipSubscription).not.toHaveBeenCalled();
    });

    it("refuses to use the free upgrade path to move to a cheaper plan immediately", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 2, title: "Cheaper", price: 20 });

      const res = await post(upgrade, { currentMembershipId: 7, newMembershipPlanId: 2 });

      expect(res.status).toBe(400);
      expect(registerMembershipSubscription).not.toHaveBeenCalled();
    });

    it("refuses when a payment is due", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 2, title: "Pricier", price: 80 });
      (calculateProratedUpgradeAmount as jest.Mock).mockReturnValue(12);

      const res = await post(upgrade, { currentMembershipId: 7, newMembershipPlanId: 2 });

      expect(res.status).toBe(400);
      expect(registerMembershipSubscription).not.toHaveBeenCalled();
    });

    it("passes on a refusal from the subscription rules, such as admin permission", async () => {
      (registerMembershipSubscription as jest.Mock).mockRejectedValue(
        new MembershipChangeError("This membership plan requires admin approval. Please contact the Makerspace.")
      );

      const res = await post(upgrade, { currentMembershipId: 7, newMembershipPlanId: 2 });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/requires admin approval/);
    });
  });

  describe("downgrade", () => {
    beforeEach(() => {
      (getOwnedMembership as jest.Mock).mockResolvedValue(activeMembership(50));
    });

    it("schedules a cheaper plan for the session member's own active membership", async () => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 3, title: "Basic", price: 30 });

      const res = await post(downgrade, { currentMembershipId: 7, newMembershipPlanId: 3, userId: 99 });

      expect(res.status).toBe(200);
      expect(getOwnedMembership).toHaveBeenCalledWith(SESSION_USER, 7, "active");
      expect(registerMembershipSubscription).toHaveBeenCalledWith(
        SESSION_USER, 3, 7, true, false, undefined, "monthly", true
      );
    });

    it.each([
      ["the same price", 50],
      ["a pricier plan", 80],
    ])("refuses %s, which the payment page would not call a downgrade", async (_label, price) => {
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 3, title: "Other", price });

      const res = await post(downgrade, { currentMembershipId: 7, newMembershipPlanId: 3 });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(
        "That plan is not cheaper than your current plan, so it cannot be scheduled as a downgrade."
      );
      expect(registerMembershipSubscription).not.toHaveBeenCalled();
    });

    it("refuses someone else's membership", async () => {
      (getOwnedMembership as jest.Mock).mockRejectedValue(new MembershipChangeError(NOT_YOURS));
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 3, title: "Basic", price: 30 });

      const res = await post(downgrade, { currentMembershipId: 77, newMembershipPlanId: 3 });

      expect(res.status).toBe(400);
      expect(registerMembershipSubscription).not.toHaveBeenCalled();
    });
  });

  describe("resubscribe", () => {
    it("reactivates only the session member's own cancelled membership", async () => {
      (getOwnedMembership as jest.Mock).mockResolvedValue({
        id: 9,
        userId: SESSION_USER,
        membershipPlanId: 2,
        status: "cancelled",
        billingCycle: "quarterly",
      });
      (getMembershipPlanById as jest.Mock).mockResolvedValue({ id: 2, title: "Member", price: 50, price3Months: 140 });

      const res = await post(resubscribe, { currentMembershipId: 9, membershipPlanId: 2, userId: 99 });

      expect(await res.json()).toEqual({ success: true });
      expect(getOwnedMembership).toHaveBeenCalledWith(SESSION_USER, 9, "cancelled");
      expect(registerMembershipSubscription).toHaveBeenCalledWith(
        SESSION_USER, 2, 9, false, true, undefined, "quarterly", true
      );
    });

    it("refuses another member's cancelled membership", async () => {
      (getOwnedMembership as jest.Mock).mockRejectedValue(new MembershipChangeError(NOT_YOURS));

      const res = await post(resubscribe, { currentMembershipId: 77, membershipPlanId: 2 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, error: NOT_YOURS });
      expect(registerMembershipSubscription).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["upgrade", upgrade],
    ["downgrade", downgrade],
    ["resubscribe", resubscribe],
  ])("%s refuses a signed-out visitor", async (_label, handler) => {
    (getUser as jest.Mock).mockResolvedValue(null);

    const res = await post(handler, { currentMembershipId: 7, newMembershipPlanId: 2, membershipPlanId: 2 });

    expect(res.status).toBe(401);
    expect(registerMembershipSubscription).not.toHaveBeenCalled();
  });
});
