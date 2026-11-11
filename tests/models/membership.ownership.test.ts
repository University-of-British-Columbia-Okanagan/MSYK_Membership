import "tests/fixtures/membership/setup";

import { getMembershipMocks, resetMembershipMocks } from "tests/fixtures/membership/setup";
import type { MembershipDbMock } from "tests/fixtures/membership/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  addMonths,
  createMockMembership,
  createMockPlan,
  createMockUser,
} from "tests/fixtures/membership/memberships";
import {
  MembershipChangeError,
  assertPlanPermission,
  getOwnedMembership,
  getPlanPriceForCycle,
  registerMembershipSubscription,
} from "~/models/membership.server";

const NOW = new Date("2026-11-10T19:00:00.000Z");

describe("membership.server - a member can only change their own membership", () => {
  let db: MembershipDbMock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    clearAllMocks();
    resetMembershipMocks();
    ({ db } = getMembershipMocks());
    db.user.findUnique.mockResolvedValue(createMockUser({ id: 5, roleLevel: 3 }));
    db.membershipPlan.findUnique.mockResolvedValue(createMockPlan({ id: 2, price: 50 }));
    db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
    db.userMembership.findFirst.mockResolvedValue(null);
  });

  afterEach(() => jest.useRealTimers());

  const othersMembership = (status: "active" | "cancelled") =>
    createMockMembership({
      id: 77,
      userId: 9,
      membershipPlanId: 2,
      status,
      nextPaymentDate: addMonths(NOW, 1),
      membershipPlan: createMockPlan({ id: 2, price: 50 }),
    });

  describe("getPlanPriceForCycle", () => {
    const plan = createMockPlan({ price: 50, price3Months: 140, price6Months: 270, priceYearly: 500 });

    it.each([
      ["monthly", 50],
      ["quarterly", 140],
      ["semiannually", 270],
      ["yearly", 500],
    ] as const)("reads the %s price", (cycle, price) => {
      expect(getPlanPriceForCycle(plan, cycle)).toBe(price);
    });

    it("returns null for a cycle the plan has no price for, instead of the monthly price", () => {
      expect(getPlanPriceForCycle(createMockPlan({ price: 50, priceYearly: null }), "yearly")).toBeNull();
    });

    it("returns null for a cycle that does not exist", () => {
      expect(getPlanPriceForCycle(plan, "weekly")).toBeNull();
    });
  });

  describe("getOwnedMembership", () => {
    it("returns the member's own membership in the required status", async () => {
      const mine = createMockMembership({ id: 7, userId: 5, status: "active" });
      db.userMembership.findUnique.mockResolvedValue(mine);

      await expect(getOwnedMembership(5, 7, "active")).resolves.toBe(mine);
      expect(db.userMembership.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        include: { membershipPlan: true },
      });
    });

    it("refuses another member's membership", async () => {
      db.userMembership.findUnique.mockResolvedValue(othersMembership("active"));

      await expect(getOwnedMembership(5, 77, "active")).rejects.toThrow(
        new MembershipChangeError("That membership could not be found on your account.")
      );
    });

    it("refuses a membership in the wrong status", async () => {
      db.userMembership.findUnique.mockResolvedValue(createMockMembership({ id: 7, userId: 5, status: "ending" }));

      await expect(getOwnedMembership(5, 7, "active")).rejects.toThrow(
        "Only an active membership can be upgraded or downgraded."
      );
      await expect(getOwnedMembership(5, 7, "cancelled")).rejects.toThrow(
        "Only a cancelled membership can be resubscribed."
      );
    });

    it("refuses an id that does not parse", async () => {
      await expect(getOwnedMembership(5, NaN, "active")).rejects.toThrow(
        "That membership could not be found on your account."
      );
      expect(db.userMembership.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("assertPlanPermission: the payment page's needAdminPermission rule", () => {
    const gated = createMockPlan({ needAdminPermission: true });

    it.each([
      ["level 2 with admin permission", 2, true],
      ["level 3 without admin permission", 3, false],
    ])("refuses %s", (_label, roleLevel, allowLevel4) => {
      expect(() => assertPlanPermission({ roleLevel, allowLevel4 }, gated)).toThrow(
        "This membership plan requires admin approval. Please contact the Makerspace."
      );
    });

    it("allows level 3 or above with admin permission", () => {
      expect(() => assertPlanPermission({ roleLevel: 3, allowLevel4: true }, gated)).not.toThrow();
    });

    it("does not gate an ordinary plan", () => {
      expect(() => assertPlanPermission({ roleLevel: 1, allowLevel4: false }, createMockPlan())).not.toThrow();
    });
  });

  describe("registerMembershipSubscription", () => {
    it("will not resubscribe someone else's cancelled membership", async () => {
      db.userMembership.findUnique.mockResolvedValue(othersMembership("cancelled"));

      await expect(
        registerMembershipSubscription(5, 2, 77, false, true, undefined, "monthly", true)
      ).rejects.toThrow("That membership could not be found on your account.");
      expect(db.userMembership.update).not.toHaveBeenCalled();
    });

    it("will not resubscribe a membership that is not cancelled", async () => {
      db.userMembership.findUnique.mockResolvedValue(
        createMockMembership({ id: 7, userId: 5, membershipPlanId: 2, status: "inactive" as any })
      );

      await expect(
        registerMembershipSubscription(5, 2, 7, false, true, undefined, "monthly", true)
      ).rejects.toThrow("Only a cancelled membership can be resubscribed.");
      expect(db.userMembership.update).not.toHaveBeenCalled();
    });

    it("will not resubscribe a membership onto a different plan", async () => {
      db.userMembership.findUnique.mockResolvedValue(
        createMockMembership({ id: 7, userId: 5, membershipPlanId: 3, status: "cancelled" })
      );

      await expect(
        registerMembershipSubscription(5, 2, 7, false, true, undefined, "monthly", true)
      ).rejects.toThrow("That membership is for a different plan.");
      expect(db.userMembership.update).not.toHaveBeenCalled();
    });

    it.each([
      ["upgrade", false],
      ["downgrade", true],
    ])("will not %s from someone else's membership", async (_label, isDowngrade) => {
      db.userMembership.findUnique.mockResolvedValue(othersMembership("active"));

      await expect(
        registerMembershipSubscription(5, 2, 77, isDowngrade, false, "pi_1", "monthly", true)
      ).rejects.toThrow("That membership could not be found on your account.");
      expect(db.userMembership.update).not.toHaveBeenCalled();
      expect(db.userMembership.create).not.toHaveBeenCalled();
    });

    it("will not change plans from a membership that is already ending", async () => {
      db.userMembership.findUnique.mockResolvedValue(
        createMockMembership({ id: 7, userId: 5, status: "ending", membershipPlan: createMockPlan({ id: 1 }) })
      );

      await expect(
        registerMembershipSubscription(5, 2, 7, false, false, "pi_1", "monthly", true)
      ).rejects.toThrow("Only an active membership can be upgraded or downgraded.");
      expect(db.userMembership.create).not.toHaveBeenCalled();
    });

    it("refuses a plan that needs admin permission the member does not have, even on resubscribe", async () => {
      db.membershipPlan.findUnique.mockResolvedValue(createMockPlan({ id: 2, needAdminPermission: true }));
      db.user.findUnique.mockResolvedValue(createMockUser({ id: 5, roleLevel: 3, allowLevel4: false }));
      db.userMembership.findUnique.mockResolvedValue(
        createMockMembership({ id: 7, userId: 5, membershipPlanId: 2, status: "cancelled" })
      );

      await expect(
        registerMembershipSubscription(5, 2, 7, false, true, undefined, "monthly", true)
      ).rejects.toThrow("requires admin approval");
      await expect(registerMembershipSubscription(5, 2)).rejects.toThrow("requires admin approval");
      expect(db.userMembership.update).not.toHaveBeenCalled();
      expect(db.userMembership.create).not.toHaveBeenCalled();
    });

    it("allows that plan when the member is level 3 with admin permission", async () => {
      db.membershipPlan.findUnique.mockResolvedValue(createMockPlan({ id: 2, needAdminPermission: true }));
      db.user.findUnique.mockResolvedValue(createMockUser({ id: 5, roleLevel: 3, allowLevel4: true }));
      db.userMembership.create.mockResolvedValue(createMockMembership({ id: 8, userId: 5 }));

      await expect(registerMembershipSubscription(5, 2)).resolves.toMatchObject({ id: 8 });
    });
  });
});
