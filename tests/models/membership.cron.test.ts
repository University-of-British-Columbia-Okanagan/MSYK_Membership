import "tests/fixtures/membership/setup";

import {
  getMembershipMocks,
  resetMembershipMocks,
} from "tests/fixtures/membership/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createMockMembership,
  createMockPlan,
  createMockUser,
  createMockPaymentInformation,
  addMonths,
  addDays,
} from "tests/fixtures/membership/memberships";
import type { MembershipDbMock } from "tests/fixtures/membership/setup";
import { startMonthlyMembershipCheck } from "~/models/membership.server";

describe("membership.server - cron", () => {
  const baseNow = new Date("2025-05-06T00:00:00Z");
  let db: MembershipDbMock;
  let mocks: ReturnType<typeof getMembershipMocks>;

  const runCron = async () => {
    startMonthlyMembershipCheck();
    const job = mocks.scheduledJobs[mocks.scheduledJobs.length - 1];
    await Promise.resolve(job.execution);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseNow);
    clearAllMocks();
    resetMembershipMocks();
    mocks = getMembershipMocks();
    db = mocks.db;
    mocks.resetScheduledJobs();
    mocks.resetStripeMocks();
    mocks.resetEmailMocks();
    mocks.resetAdminSettingMock();
    mocks.mockGetAdminSetting.mockResolvedValue("5");
    mocks.stripePaymentIntentsCreateMock.mockResolvedValue({
      id: "pi_monthly",
      status: "succeeded",
    });
    db.userMembershipForm.updateMany.mockResolvedValue({ count: 1 });
    db.user.update.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("charges active monthly memberships with saved payment info and advances nextPaymentDate", async () => {
    const plan = createMockPlan({ id: 1, price: 100 });
    const membership = createMockMembership({
      id: 1,
      userId: 1,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: baseNow,
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([membership])
      .mockResolvedValueOnce([]);
    db.user.findUnique.mockResolvedValueOnce(
      createMockUser({ id: 1, roleLevel: 2 })
    );
    db.userPaymentInformation.findUnique.mockResolvedValueOnce(
      createMockPaymentInformation()
    );
    db.userMembership.update.mockResolvedValueOnce({
      ...membership,
      nextPaymentDate: addMonths(baseNow, 1),
      paymentIntentId: "pi_monthly",
    });
    db.userMembership.findFirst.mockResolvedValueOnce(
      createMockMembership({
        id: 1,
        userId: 1,
        membershipPlanId: plan.id,
        status: "active",
        membershipPlan: plan,
      })
    );

    await runCron();

    expect(mocks.stripePaymentIntentsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10500,
        customer: "cus_123",
        payment_method: "pm_123",
        off_session: true,
        metadata: expect.objectContaining({
          membershipId: String(membership.id),
          gst_percentage: "5",
        }),
      })
    );
    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: membership.id },
      data: expect.objectContaining({
        nextPaymentDate: addMonths(baseNow, 1),
        paymentIntentId: "pi_monthly",
      }),
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { roleLevel: 3 },
    });
    expect(
      mocks.mockSendMembershipEndedNoPaymentMethodEmail
    ).not.toHaveBeenCalled();
  });

  it("marks memberships without saved payment info inactive and notifies user", async () => {
    const plan = createMockPlan({ id: 2, price: 90 });
    const membership = createMockMembership({
      id: 2,
      userId: 7,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: baseNow,
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([membership])
      .mockResolvedValueOnce([]);
    db.user.findUnique.mockResolvedValueOnce(
      createMockUser({ id: 7, email: "no-card@example.com", roleLevel: 3 })
    );
    db.userPaymentInformation.findUnique.mockResolvedValueOnce(null);
    db.userMembership.update.mockResolvedValueOnce({
      ...membership,
      status: "inactive",
    });
    db.userMembership.findFirst.mockResolvedValueOnce(null);

    await runCron();

    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: membership.id },
      data: { status: "inactive" },
    });
    expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: membership.userId,
        membershipPlanId: plan.id,
        status: { in: ["pending", "active", "cancelled", "ending"] },
      }),
      data: { status: "inactive" },
    });
    expect(
      mocks.mockSendMembershipEndedNoPaymentMethodEmail
    ).toHaveBeenCalledWith({
      userEmail: "no-card@example.com",
      planTitle: plan.title,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: membership.userId },
      data: { roleLevel: 2 },
    });
  });

  it("expires non-monthly memberships without charging and updates forms", async () => {
    const plan = createMockPlan({ id: 3, price: 260 });
    const membership = createMockMembership({
      id: 3,
      userId: 12,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "quarterly",
      nextPaymentDate: baseNow,
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([membership])
      .mockResolvedValueOnce([]);
    db.user.findUnique.mockResolvedValueOnce(
      createMockUser({ id: 12, roleLevel: 3 })
    );
    db.userMembership.update.mockResolvedValueOnce({
      ...membership,
      status: "inactive",
    });
    db.userMembership.findFirst.mockResolvedValueOnce(null);

    await runCron();

    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: membership.id },
      data: { status: "inactive" },
    });
    expect(mocks.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: membership.userId,
        membershipPlanId: plan.id,
        status: { in: ["pending", "active", "cancelled", "ending"] },
      }),
      data: { status: "inactive" },
    });
  });

  it("moves ending or cancelled memberships to inactive status", async () => {
    const plan = createMockPlan({ id: 4, price: 80 });
    const ending = createMockMembership({
      id: 4,
      userId: 20,
      status: "ending",
      membershipPlanId: plan.id,
      membershipPlan: plan,
    });
    const cancelled = createMockMembership({
      id: 5,
      userId: 21,
      status: "cancelled",
      membershipPlanId: plan.id,
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([ending, cancelled])
      .mockResolvedValueOnce([]);
    db.user.findUnique
      .mockResolvedValueOnce(createMockUser({ id: 20, roleLevel: 3 }))
      .mockResolvedValueOnce(createMockUser({ id: 21, roleLevel: 3 }));
    db.userMembership.update
      .mockResolvedValueOnce({ ...ending, status: "inactive" })
      .mockResolvedValueOnce({ ...cancelled, status: "inactive" });
    db.userMembership.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await runCron();

    expect(db.userMembership.update).toHaveBeenCalledTimes(2);
    expect(db.userMembership.update).toHaveBeenNthCalledWith(1, {
      where: { id: ending.id },
      data: { status: "inactive" },
    });
    expect(db.userMembership.update).toHaveBeenNthCalledWith(2, {
      where: { id: cancelled.id },
      data: { status: "inactive" },
    });
    expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: ending.userId,
        membershipPlanId: plan.id,
        status: { in: ["pending", "active", "cancelled", "ending"] },
      }),
      data: { status: "inactive" },
    });
    expect(db.userMembershipForm.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: cancelled.userId,
        membershipPlanId: plan.id,
        status: { in: ["pending", "active", "cancelled", "ending"] },
      }),
      data: { status: "inactive" },
    });
  });

  it("promotes eligible users to role level 4 when plan requires admin permission", async () => {
    const plan = createMockPlan({ id: 6, price: 140, needAdminPermission: true });
    const membership = createMockMembership({
      id: 6,
      userId: 30,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: baseNow,
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([membership])
      .mockResolvedValueOnce([]);
    db.user.findUnique
      .mockResolvedValueOnce(
        createMockUser({ id: 30, roleLevel: 3, allowLevel4: true })
      )
      .mockResolvedValueOnce(
        createMockUser({ id: 30, roleLevel: 3, allowLevel4: true })
      );
    db.userPaymentInformation.findUnique.mockResolvedValueOnce(
      createMockPaymentInformation()
    );
    db.userMembership.update.mockResolvedValueOnce({
      ...membership,
      nextPaymentDate: addMonths(baseNow, 1),
      paymentIntentId: "pi_monthly",
    });
    db.userMembership.findFirst.mockResolvedValueOnce({
      ...membership,
      membershipPlan: plan,
    });

    await runCron();

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { roleLevel: 4 },
    });
  });

  it("sends payment reminders for memberships due within 24 hours", async () => {
    const plan = createMockPlan({ id: 7, price: 75 });
    const withCard = createMockMembership({
      id: 7,
      userId: 41,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: addDays(baseNow, 1),
      membershipPlan: plan,
    });
    const withoutCard = createMockMembership({
      id: 8,
      userId: 42,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: addDays(baseNow, 1),
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([withCard, withoutCard]);
    db.user.findUnique
      .mockResolvedValueOnce(createMockUser({ id: 41, email: "with@card.com" }))
      .mockResolvedValueOnce(
        createMockUser({ id: 42, email: "without@card.com" })
      );
    db.userPaymentInformation.findUnique
      .mockResolvedValueOnce(createMockPaymentInformation())
      .mockResolvedValueOnce(
        createMockPaymentInformation({
          stripeCustomerId: null,
          stripePaymentMethodId: null,
        })
      );

    await runCron();

    const reminderCalls =
      mocks.mockSendMembershipPaymentReminderEmail.mock.calls.map(
        ([args]) => args
      );
    expect(reminderCalls).toHaveLength(2);
    expect(reminderCalls.map((call) => call.needsPaymentMethod)).toEqual(
      expect.arrayContaining([false, true])
    );
    reminderCalls.forEach((call) => {
      expect(call.planTitle).toBe(plan.title);
      expect(call.gstPercentage).toBe(5);
      expect(call.amountDue).toBeCloseTo(78.75);
      expect(typeof call.userEmail).toBe("string");
      expect(call.nextPaymentDate).toEqual(addDays(baseNow, 1));
    });
  });
});

