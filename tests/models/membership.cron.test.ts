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

  it("registers on the daily midnight schedule", async () => {
    db.userMembership.findMany.mockResolvedValue([]);

    await runCron();

    expect(mocks.mockCronSchedule).toHaveBeenCalledWith(
      "0 0 * * *",
      expect.any(Function)
    );
  });

  it("survives a database failure so the daily job keeps running", async () => {
    db.userMembership.findMany.mockRejectedValue(new Error("db down"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCron()).resolves.not.toThrow();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("carries a recurring discount into the renewal and mirrors it onto the membership", async () => {
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
    const discountEnd = new Date("2025-07-10T10:00:00Z");

    db.userMembership.findMany
      .mockResolvedValueOnce([membership])
      .mockResolvedValueOnce([]);
    db.user.findUnique.mockResolvedValueOnce(
      createMockUser({ id: 1, roleLevel: 3 })
    );
    db.userPaymentInformation.findUnique.mockResolvedValueOnce(
      createMockPaymentInformation()
    );
    mocks.chargeMembershipViaInvoiceMock.mockResolvedValueOnce({
      invoiceId: "in_disc",
      paymentIntentId: "pi_disc",
      status: "paid",
      subtotal: 100,
      discountAmount: 50,
      taxAmount: 2.5,
      total: 52.5,
    });
    mocks.getCustomerDiscountMock.mockResolvedValueOnce({
      couponId: "co_half",
      percentOff: 50,
      amountOff: null,
      endsAt: discountEnd,
    });
    db.userMembership.update.mockResolvedValueOnce({ ...membership });
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

    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: membership.id },
      data: expect.objectContaining({
        paymentIntentId: "pi_disc",
        stripeCouponId: "co_half",
        discountEndsAt: discountEnd,
      }),
    });
  });

  it("clears the mirrored discount once Stripe has expired it", async () => {
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
      createMockUser({ id: 1, roleLevel: 3 })
    );
    db.userPaymentInformation.findUnique.mockResolvedValueOnce(
      createMockPaymentInformation()
    );
    mocks.getCustomerDiscountMock.mockResolvedValueOnce(null);
    db.userMembership.update.mockResolvedValueOnce({ ...membership });
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

    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: membership.id },
      data: expect.objectContaining({
        stripeCouponId: null,
        discountEndsAt: null,
      }),
    });
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

    // Charged as an invoice, not a PaymentIntent: only an invoice carries a discount.
    // The base amount goes over untaxed — GST is applied by the Stripe tax rate, so it
    // lands on the post-discount amount rather than the list price.
    expect(mocks.chargeMembershipViaInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus_123",
        paymentMethodId: "pm_123",
        baseAmount: 100,
        gstPercentage: 5,
        stripeProductId: plan.stripeProductId,
        metadata: expect.objectContaining({
          membershipId: String(membership.id),
          gst_percentage: "5",
        }),
      })
    );
    expect(mocks.stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    expect(db.userMembership.update).toHaveBeenCalledWith({
      where: { id: membership.id },
      data: expect.objectContaining({
        nextPaymentDate: addMonths(baseNow, 1),
        paymentIntentId: "pi_test",
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

  it("marks a quarterly membership inactive when it has no saved card", async () => {
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
    // Nothing is charged because there is no card — not because the cycle is quarterly.
    expect(mocks.chargeMembershipViaInvoiceMock).not.toHaveBeenCalled();
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

  // Every billing cycle is charged by the same daily job. What differs is which price it
  // reads and how far nextPaymentDate moves — the coupon itself is Stripe's business, and
  // is exercised against real Stripe in test-scripts/test-membership-renewal.ts.
  describe("billing cycles", () => {
    const CYCLES = [
      { cycle: "monthly", months: 1, priceField: "price", expected: 50 },
      { cycle: "quarterly", months: 3, priceField: "price3Months", expected: 135 },
      { cycle: "semiannually", months: 6, priceField: "price6Months", expected: 260 },
      { cycle: "yearly", months: 12, priceField: "priceYearly", expected: 500 },
    ] as const;

    const planWithEveryPrice = () =>
      createMockPlan({
        id: 1,
        price: 50,
        price3Months: 135,
        price6Months: 260,
        priceYearly: 500,
        stripeProductId: "prod_cycle",
      });

    const arrangeDueMembership = (
      cycle: (typeof CYCLES)[number]["cycle"],
      plan: ReturnType<typeof createMockPlan>
    ) => {
      const membership = createMockMembership({
        id: 1,
        userId: 1,
        membershipPlanId: plan.id,
        status: "active",
        billingCycle: cycle,
        nextPaymentDate: baseNow,
        membershipPlan: plan,
      });

      db.userMembership.findMany
        .mockResolvedValueOnce([membership])
        .mockResolvedValueOnce([]);
      db.user.findUnique.mockResolvedValueOnce(
        createMockUser({ id: 1, roleLevel: 3 })
      );
      db.userPaymentInformation.findUnique.mockResolvedValueOnce(
        createMockPaymentInformation()
      );
      db.userMembership.update.mockResolvedValueOnce({ ...membership });
      db.userMembership.findFirst.mockResolvedValueOnce(membership);

      return membership;
    };

    it.each(CYCLES)(
      "charges a $cycle membership at $priceField and advances by $months month(s)",
      async ({ cycle, months, expected }) => {
        const plan = planWithEveryPrice();
        const membership = arrangeDueMembership(cycle, plan);

        await runCron();

        expect(mocks.chargeMembershipViaInvoiceMock).toHaveBeenCalledWith(
          expect.objectContaining({
            baseAmount: expected,
            gstPercentage: 5,
            // Without the plan's Product a product-restricted coupon silently stops
            // applying after the first payment, on every cycle.
            stripeProductId: "prod_cycle",
          })
        );
        expect(db.userMembership.update).toHaveBeenCalledWith({
          where: { id: membership.id },
          data: expect.objectContaining({
            nextPaymentDate: addMonths(baseNow, months),
          }),
        });
      }
    );

    it.each([
      { cycle: "quarterly", months: 3 },
      { cycle: "semiannually", months: 6 },
      { cycle: "yearly", months: 12 },
    ] as const)(
      "falls back to the monthly price when a $cycle plan has no cycle price set",
      async ({ cycle, months }) => {
        // Plans may be sold on a longer cycle without a dedicated price configured.
        const plan = createMockPlan({
          id: 1,
          price: 50,
          price3Months: null,
          price6Months: null,
          priceYearly: null,
          stripeProductId: "prod_cycle",
        });
        const membership = arrangeDueMembership(cycle, plan);

        await runCron();

        expect(mocks.chargeMembershipViaInvoiceMock).toHaveBeenCalledWith(
          expect.objectContaining({ baseAmount: 50 })
        );
        expect(db.userMembership.update).toHaveBeenCalledWith({
          where: { id: membership.id },
          data: expect.objectContaining({
            nextPaymentDate: addMonths(baseNow, months),
          }),
        });
      }
    );

    it.each(CYCLES)(
      "records a discount taken on a $cycle renewal",
      async ({ cycle, expected }) => {
        const plan = planWithEveryPrice();
        const membership = arrangeDueMembership(cycle, plan);
        const endsAt = new Date("2025-07-10T10:00:00Z");

        mocks.chargeMembershipViaInvoiceMock.mockResolvedValueOnce({
          invoiceId: "in_cycle",
          paymentIntentId: "pi_cycle",
          status: "paid",
          subtotal: expected,
          discountAmount: expected / 2,
          taxAmount: (expected / 2) * 0.05,
          total: (expected / 2) * 1.05,
        });
        mocks.getCustomerDiscountMock.mockResolvedValueOnce({
          couponId: "co_half",
          percentOff: 50,
          amountOff: null,
          endsAt,
        });

        await runCron();

        expect(db.userMembership.update).toHaveBeenCalledWith({
          where: { id: membership.id },
          data: expect.objectContaining({
            stripeCouponId: "co_half",
            discountEndsAt: endsAt,
          }),
        });
      }
    );

    it.each(CYCLES)(
      "quotes the $cycle reminder from the cycle price, discount included",
      async ({ cycle, expected }) => {
        const plan = planWithEveryPrice();
        const membership = createMockMembership({
          id: 2,
          userId: 2,
          membershipPlanId: plan.id,
          status: "active",
          billingCycle: cycle,
          nextPaymentDate: addDays(baseNow, 1),
          membershipPlan: plan,
        });

        db.userMembership.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([membership]);
        db.user.findUnique.mockResolvedValueOnce(
          createMockUser({ id: 2, email: "cycle@example.com" })
        );
        db.userPaymentInformation.findUnique.mockResolvedValueOnce(
          createMockPaymentInformation()
        );

        await runCron();

        expect(mocks.previewMembershipChargeMock).toHaveBeenCalledWith(
          expect.objectContaining({
            baseAmount: expected,
            gstPercentage: 5,
            // Taken as of the charge date so a discount lapsing first is not quoted.
            chargeOn: addDays(baseNow, 1),
          })
        );
      }
    );
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
    expect(
      reminderCalls.map((call) => call.needsPaymentMethod).sort()
    ).toEqual([false, true]);
    reminderCalls.forEach((call) => {
      expect(call.planTitle).toBe(plan.title);
      expect(call.gstPercentage).toBe(5);
      expect(call.amountDue).toBeCloseTo(78.75);
      expect(typeof call.userEmail).toBe("string");
      expect(call.nextPaymentDate).toEqual(addDays(baseNow, 1));
    });  });

  it("quotes the discounted amount in the reminder, not the list price", async () => {
    const plan = createMockPlan({ id: 9, price: 75 });
    const membership = createMockMembership({
      id: 9,
      userId: 43,
      membershipPlanId: plan.id,
      status: "active",
      billingCycle: "monthly",
      nextPaymentDate: addDays(baseNow, 1),
      membershipPlan: plan,
    });

    db.userMembership.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([membership]);
    db.user.findUnique.mockResolvedValueOnce(
      createMockUser({ id: 43, email: "half@price.com" })
    );
    db.userPaymentInformation.findUnique.mockResolvedValueOnce(
      createMockPaymentInformation()
    );
    mocks.previewMembershipChargeMock.mockResolvedValueOnce({
      baseAmount: 75,
      discountAmount: 37.5,
      taxAmount: 1.88,
      total: 39.38,
    });

    await runCron();

    const [args] =
      mocks.mockSendMembershipPaymentReminderEmail.mock.calls[0];
    expect(args.amountDue).toBeCloseTo(39.38);
    expect(args.baseAmount).toBeCloseTo(75);
    expect(args.discountAmount).toBeCloseTo(37.5);

    // The preview must be taken as of the charge date, so a discount that lapses
    // first is not quoted.
    expect(mocks.previewMembershipChargeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus_123",
        baseAmount: 75,
        gstPercentage: 5,
        chargeOn: addDays(baseNow, 1),
      })
    );
  });
});

