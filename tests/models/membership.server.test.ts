import "tests/fixtures/membership/setup";

import {
  getMembershipMocks,
  resetMembershipMocks,
} from "tests/fixtures/membership/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockPlan,
  createMockMembership,
  createMockMembershipForm,
  createMockUser,
  addMonths,
} from "tests/fixtures/membership/memberships";
import type { MembershipDbMock } from "tests/fixtures/membership/setup";
import {
  registerMembershipSubscriptionWithForm,
  registerMembershipSubscription,
  cancelMembership,
  calculateProratedUpgradeAmount,
} from "~/models/membership.server";

describe("membership.server - memberships", () => {
  const baseNow = new Date("2025-01-10T10:00:00Z");
  let db: MembershipDbMock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseNow);
    clearAllMocks();
    resetMembershipMocks();
    ({ db } = getMembershipMocks());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("AC13 - New Monthly Membership", () => {
    it("creates an active subscription, advances nextPaymentDate, activates form, and upgrades role level", async () => {
      const plan = createMockPlan();
      const createdMembership = createMockMembership({
        id: 42,
        date: baseNow,
        nextPaymentDate: addMonths(baseNow, 1),
        status: "active",
      });
      const pendingForm = createMockMembershipForm({
        id: 101,
        status: "pending",
      });
      const user = createMockUser({ roleLevel: 2 });

      db.membershipPlan.findUnique.mockResolvedValue(plan);
      db.userMembership.create.mockResolvedValue(createdMembership);
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
      db.userMembershipForm.findFirst.mockResolvedValue(pendingForm);
      db.userMembershipForm.update.mockResolvedValue({
        ...pendingForm,
        status: "active",
        userMembershipId: createdMembership.id,
      });
      db.user.findUnique.mockResolvedValue(user);
      db.user.update.mockResolvedValue({ ...user, roleLevel: 3 });

      const subscription = await registerMembershipSubscriptionWithForm(
        1,
        plan.id,
        null,
        false,
        false,
        "pi_new"
      );

      expect(db.membershipPlan.findUnique).toHaveBeenCalledWith({
        where: { id: plan.id },
      });
      expect(db.userMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          membershipPlanId: plan.id,
          status: "active",
          billingCycle: "monthly",
          paymentIntentId: "pi_new",
        }),
      });
      expect(subscription.status).toBe("active");
      expect(subscription.nextPaymentDate.toISOString()).toBe(
        addMonths(baseNow, 1).toISOString()
      );
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { roleLevel: 3 },
      });
      expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          membershipPlanId: plan.id,
          status: "active",
        },
        data: { status: "inactive" },
      });
      expect(db.userMembershipForm.update).toHaveBeenCalledWith({
        where: { id: pendingForm.id },
        data: { status: "active", userMembershipId: createdMembership.id },
      });
    });
  });

  describe("AC14 - Monthly to Monthly Upgrade", () => {
    it("preserves nextPaymentDate, marks old membership ending, and activates new membership", async () => {
      const currentMembership = createMockMembership({
        id: 5,
        membershipPlanId: 1,
        nextPaymentDate: addMonths(baseNow, 1),
        status: "active",
        billingCycle: "monthly",
        membershipPlan: createMockPlan({ id: 1 }),
      });
      const upgradedPlan = createMockPlan({ id: 2, title: "Pro Membership" });
      const upgradedMembership = createMockMembership({
        id: 6,
        membershipPlanId: upgradedPlan.id,
        status: "active",
        date: baseNow,
        nextPaymentDate: currentMembership.nextPaymentDate,
        membershipPlan: upgradedPlan,
      });
      const user = createMockUser({ roleLevel: 2 });

      db.membershipPlan.findUnique.mockResolvedValue(upgradedPlan);
      db.userMembership.findUnique.mockResolvedValue(currentMembership);
      db.userMembership.update.mockResolvedValue({
        ...currentMembership,
        status: "ending",
      });
      db.userMembership.findFirst.mockResolvedValue(null);
      db.userMembership.create.mockResolvedValue(upgradedMembership);
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
      db.user.findUnique.mockResolvedValue(user);
      db.user.update.mockResolvedValue({ ...user, roleLevel: 3 });

      const subscription = await registerMembershipSubscription(
        1,
        upgradedPlan.id,
        currentMembership.id,
        false,
        false,
        "pi_upgrade",
        "monthly"
      );

      expect(db.userMembership.update).toHaveBeenCalledWith({
        where: { id: currentMembership.id },
        data: { status: "ending" },
      });
      expect(db.userMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          membershipPlanId: upgradedPlan.id,
          status: "active",
          billingCycle: "monthly",
          nextPaymentDate: currentMembership.nextPaymentDate,
          paymentIntentId: "pi_upgrade",
        }),
      });
      expect(subscription.nextPaymentDate).toEqual(
        currentMembership.nextPaymentDate
      );
      expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 1,
          membershipPlanId: currentMembership.membershipPlanId,
          status: { in: ["pending", "active", "cancelled", "ending"] },
        }),
        data: { status: "ending" },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { roleLevel: 3 },
      });
    });

    it("calculates proration based on remaining days in cycle", () => {
      const now = new Date("2025-01-20T00:00:00Z");
      const nextPaymentDate = new Date("2025-02-01T00:00:00Z");

      const amount = calculateProratedUpgradeAmount(
        now,
        nextPaymentDate,
        100,
        160
      );

      const expectedProration = (160 - 100) * (12 / 31);
      expect(amount).toBeCloseTo(expectedProration, 2);
    });
  });

  describe("AC15 - Membership Downgrade", () => {
    it("schedules downgraded membership at next payment date and activates new form", async () => {
      const currentMembership = createMockMembership({
        id: 10,
        membershipPlanId: 2,
        nextPaymentDate: addMonths(baseNow, 1),
        status: "active",
        billingCycle: "monthly",
        membershipPlan: createMockPlan({ id: 2 }),
      });
      const downgradedPlan = createMockPlan({
        id: 3,
        title: "Basic Membership",
      });
      const downgradedMembership = createMockMembership({
        id: 11,
        membershipPlanId: downgradedPlan.id,
        status: "active",
        date: currentMembership.nextPaymentDate,
        nextPaymentDate: addMonths(currentMembership.nextPaymentDate, 1),
        membershipPlan: downgradedPlan,
      });

      db.membershipPlan.findUnique.mockResolvedValue(downgradedPlan);
      db.userMembership.findUnique.mockResolvedValue(currentMembership);
      db.userMembership.update.mockResolvedValue({
        ...currentMembership,
        status: "ending",
      });
      db.userMembership.findFirst.mockResolvedValue(null);
      db.userMembership.create.mockResolvedValue(downgradedMembership);
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });

      const subscription = await registerMembershipSubscription(
        1,
        downgradedPlan.id,
        currentMembership.id,
        true,
        false,
        undefined,
        "monthly"
      );

      expect(db.userMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          membershipPlanId: downgradedPlan.id,
          status: "active",
          billingCycle: "monthly",
          date: currentMembership.nextPaymentDate,
          nextPaymentDate: addMonths(currentMembership.nextPaymentDate, 1),
        }),
      });
      expect(subscription.date).toEqual(currentMembership.nextPaymentDate);
      expect(subscription.status).toBe("active");
      expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 1,
          membershipPlanId: currentMembership.membershipPlanId,
          status: { in: ["pending", "active", "cancelled", "ending"] },
        }),
        data: { status: "ending" },
      });
    });
  });

  describe("AC16 - Cancellation Before Cycle End", () => {
    it("marks membership and form as cancelled without changing role level", async () => {
      const activeMembership = createMockMembership({
        id: 20,
        nextPaymentDate: addMonths(baseNow, 1),
        status: "active",
      });

      db.userMembership.findFirst.mockResolvedValue(activeMembership);
      db.userMembership.update.mockResolvedValue({
        ...activeMembership,
        status: "cancelled",
      });
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });

      const result = await cancelMembership(1, activeMembership.membershipPlanId);

      expect(result?.status).toBe("cancelled");
      expect(db.userMembership.update).toHaveBeenCalledWith({
        where: { id: activeMembership.id },
        data: { status: "cancelled" },
      });
      expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 1,
          membershipPlanId: activeMembership.membershipPlanId,
          status: { in: ["pending", "active", "cancelled", "ending"] },
        }),
        data: { status: "cancelled" },
      });
      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  describe("AC17 - Cancellation After Cycle End", () => {
    it("deletes membership, sets form inactive, and downgrades role to level 2 when orientation completed", async () => {
      const expiredMembership = createMockMembership({
        id: 30,
        nextPaymentDate: new Date("2024-12-01T00:00:00Z"),
        status: "active",
      });

      db.userMembership.findFirst.mockResolvedValue(expiredMembership);
      db.userMembership.delete.mockResolvedValue(expiredMembership);
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
      db.userWorkshop.count.mockResolvedValue(2);
      db.user.update.mockResolvedValue({});

      const result = await cancelMembership(
        1,
        expiredMembership.membershipPlanId
      );

      expect(result?.id).toBe(expiredMembership.id);
      expect(db.userMembership.delete).toHaveBeenCalledWith({
        where: { id: expiredMembership.id },
      });
      expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 1,
          membershipPlanId: expiredMembership.membershipPlanId,
          status: { in: ["pending", "active", "cancelled", "ending"] },
        }),
        data: { status: "inactive" },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { roleLevel: 2 },
      });
    });

    it("downgrades role to level 1 when no orientations completed", async () => {
      const expiredMembership = createMockMembership({
        id: 31,
        nextPaymentDate: new Date("2024-11-01T00:00:00Z"),
        status: "active",
      });

      db.userMembership.findFirst.mockResolvedValue(expiredMembership);
      db.userMembership.delete.mockResolvedValue(expiredMembership);
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
      db.userWorkshop.count.mockResolvedValue(0);
      db.user.update.mockResolvedValue({});

      await cancelMembership(1, expiredMembership.membershipPlanId);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { roleLevel: 1 },
      });
    });
  });

  describe("AC18 - Membership Resubscription", () => {
    it("reactivates cancelled membership, recalculates nextPaymentDate, reactivates form, and restores role level", async () => {
      const cancelledMembership = createMockMembership({
        id: 40,
        status: "cancelled",
        nextPaymentDate: addMonths(baseNow, 1),
      });
      const reactivatedMembership = {
        ...cancelledMembership,
        status: "active" as const,
        nextPaymentDate: addMonths(baseNow, 1),
      };
      const user = createMockUser({ roleLevel: 2 });

      db.membershipPlan.findUnique.mockResolvedValue(
        createMockPlan({ id: cancelledMembership.membershipPlanId })
      );
      db.userMembership.findFirst.mockResolvedValue(cancelledMembership);
      db.userMembership.update.mockResolvedValue(reactivatedMembership);
      db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
      db.user.findUnique.mockResolvedValue(user);
      db.user.update.mockResolvedValue({ ...user, roleLevel: 3 });

      const result = await registerMembershipSubscription(
        1,
        cancelledMembership.membershipPlanId,
        null,
        false,
        true,
        undefined,
        "monthly"
      );

      expect(result.status).toBe("active");
      expect(db.userMembership.update).toHaveBeenCalledWith({
        where: { id: cancelledMembership.id },
        data: expect.objectContaining({
          status: "active",
          nextPaymentDate: expect.any(Date),
        }),
      });
      expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 1,
          membershipPlanId: cancelledMembership.membershipPlanId,
          status: { in: ["pending", "active", "cancelled", "ending"] },
        }),
        data: {
          status: "active",
          userMembershipId: cancelledMembership.id,
        },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { roleLevel: 3 },
      });
    });
  });
});

