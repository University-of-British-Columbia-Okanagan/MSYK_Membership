const createMembershipDbMock = () => ({
  db: {
    membershipPlan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userMembership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    userMembershipForm: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userPaymentInformation: {
      findUnique: jest.fn(),
    },
    userWorkshop: {
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
});

export type MembershipDbMock = ReturnType<typeof createMembershipDbMock>["db"];

jest.mock("~/utils/db.server", () => createMembershipDbMock());

const mockGetAdminSetting = jest.fn().mockResolvedValue("5");

jest.mock("~/models/admin.server", () => ({
  getAdminSetting: mockGetAdminSetting,
}));

const mockSendMembershipEndedNoPaymentMethodEmail = jest.fn();
const mockSendMembershipPaymentReminderEmail = jest.fn();
const mockSendMembershipRevokedEmail = jest.fn();
const mockSendMembershipUnrevokedEmail = jest.fn();

jest.mock("~/utils/email.server", () => ({
  sendMembershipEndedNoPaymentMethodEmail:
    mockSendMembershipEndedNoPaymentMethodEmail,
  sendMembershipPaymentReminderEmail: mockSendMembershipPaymentReminderEmail,
  sendMembershipRevokedEmail: mockSendMembershipRevokedEmail,
  sendMembershipUnrevokedEmail: mockSendMembershipUnrevokedEmail,
}));

export const stripePaymentIntentsCreateMock = jest
  .fn()
  .mockResolvedValue({ id: "pi_test", status: "succeeded" });

export const stripeConstructorMock = jest
  .fn()
  .mockImplementation(() => ({
    paymentIntents: {
      create: stripePaymentIntentsCreateMock,
    },
  }));

jest.mock("stripe", () => ({
  __esModule: true,
  default: stripeConstructorMock,
  Stripe: stripeConstructorMock,
}));

export const chargeMembershipViaInvoiceMock = jest.fn();
export const clearMembershipDiscountMock = jest.fn();
export const getCustomerDiscountMock = jest.fn();
export const previewMembershipChargeMock = jest.fn();
export const getOrCreateGstTaxRateMock = jest.fn();
export const applyMembershipDiscountMock = jest.fn();
export const getCheckoutSessionCouponIdMock = jest.fn();

jest.mock("~/services/stripe-discounts.server", () => ({
  chargeMembershipViaInvoice: chargeMembershipViaInvoiceMock,
  clearMembershipDiscount: clearMembershipDiscountMock,
  getCustomerDiscount: getCustomerDiscountMock,
  previewMembershipCharge: previewMembershipChargeMock,
  getOrCreateGstTaxRate: getOrCreateGstTaxRateMock,
  applyMembershipDiscount: applyMembershipDiscountMock,
  getCheckoutSessionCouponId: getCheckoutSessionCouponIdMock,
}));

const round = (value: number) => Math.round(value * 100) / 100;

/** Undiscounted defaults, so a spec opts in to a discount rather than out of one. */
const resetDiscountMocks = () => {
  chargeMembershipViaInvoiceMock.mockReset();
  chargeMembershipViaInvoiceMock.mockImplementation(
    async ({
      baseAmount,
      gstPercentage,
    }: {
      baseAmount: number;
      gstPercentage: number;
    }) => {
      const taxAmount = round(baseAmount * (gstPercentage / 100));
      return {
        invoiceId: "in_test",
        paymentIntentId: "pi_test",
        status: "paid",
        subtotal: round(baseAmount),
        discountAmount: 0,
        taxAmount,
        total: round(baseAmount + taxAmount),
      };
    }
  );

  previewMembershipChargeMock.mockReset();
  previewMembershipChargeMock.mockImplementation(
    async ({
      baseAmount,
      gstPercentage,
    }: {
      baseAmount: number;
      gstPercentage: number;
    }) => {
      const taxAmount = round(baseAmount * (gstPercentage / 100));
      return {
        baseAmount: round(baseAmount),
        discountAmount: 0,
        taxAmount,
        total: round(baseAmount + taxAmount),
      };
    }
  );

  clearMembershipDiscountMock.mockReset();
  clearMembershipDiscountMock.mockResolvedValue(false);
  getCustomerDiscountMock.mockReset();
  getCustomerDiscountMock.mockResolvedValue(null);
  getOrCreateGstTaxRateMock.mockReset();
  getOrCreateGstTaxRateMock.mockResolvedValue("txr_test");
  applyMembershipDiscountMock.mockReset();
  applyMembershipDiscountMock.mockResolvedValue(null);
  getCheckoutSessionCouponIdMock.mockReset();
  getCheckoutSessionCouponIdMock.mockResolvedValue(null);
};

type ScheduledJob = {
  expression: string;
  handler: () => unknown;
  execution: unknown;
};

const scheduledJobs: ScheduledJob[] = [];

const cronScheduleMock = jest.fn(
  (expression: string, handler: () => unknown) => {
    const execution = handler();
    scheduledJobs.push({ expression, handler, execution });
    return {
      stop: jest.fn(),
      start: jest.fn(),
    };
  }
);

jest.mock("node-cron", () => ({
  __esModule: true,
  default: {
    schedule: cronScheduleMock,
  },
}));

const resetScheduledJobs = () => {
  scheduledJobs.length = 0;
  cronScheduleMock.mockClear();
};

const resetStripeMocks = () => {
  stripeConstructorMock.mockClear();
  stripePaymentIntentsCreateMock.mockClear();
};

const resetEmailMocks = () => {
  mockSendMembershipEndedNoPaymentMethodEmail.mockClear();
  mockSendMembershipPaymentReminderEmail.mockClear();
  mockSendMembershipRevokedEmail.mockClear();
  mockSendMembershipUnrevokedEmail.mockClear();
};

const resetAdminSettingMock = () => {
  mockGetAdminSetting.mockClear();
  mockGetAdminSetting.mockResolvedValue("5");
};

/** Prisma list queries always resolve to an array — an unset mock resolving to
 *  undefined is a fixture bug that reads like an app crash. */
const resetDbDefaults = () => {
  const { db } = require("~/utils/db.server");
  db.userMembership.findMany.mockResolvedValue([]);
  db.userMembership.updateMany.mockResolvedValue({ count: 0 });
  db.userPaymentInformation.findUnique.mockResolvedValue(null);
};

export { db } from "~/utils/db.server";

export const getMembershipMocks = () => {
  const { db } = require("~/utils/db.server");
  const { getAdminSetting } = require("~/models/admin.server");
  const {
    sendMembershipEndedNoPaymentMethodEmail,
    sendMembershipPaymentReminderEmail,
  } = require("~/utils/email.server");
  const cron = require("node-cron").default;
  const Stripe = require("stripe").default;

  return {
    db,
    mockGetAdminSetting: getAdminSetting as jest.Mock,
    mockSendMembershipEndedNoPaymentMethodEmail:
      sendMembershipEndedNoPaymentMethodEmail as jest.Mock,
    mockSendMembershipPaymentReminderEmail:
      sendMembershipPaymentReminderEmail as jest.Mock,
    mockSendMembershipRevokedEmail: mockSendMembershipRevokedEmail,
    mockSendMembershipUnrevokedEmail: mockSendMembershipUnrevokedEmail,
    mockCronSchedule: cronScheduleMock,
    scheduledJobs,
    stripeConstructorMock: Stripe as jest.Mock,
    stripePaymentIntentsCreateMock,
    chargeMembershipViaInvoiceMock,
    clearMembershipDiscountMock,
    getCustomerDiscountMock,
    previewMembershipChargeMock,
    resetScheduledJobs,
    resetStripeMocks,
    resetEmailMocks,
    resetAdminSettingMock,
  };
};

export const resetMembershipMocks = () => {
  resetStripeMocks();
  resetAdminSettingMock();
  resetEmailMocks();
  resetScheduledJobs();
  resetDiscountMocks();
  resetDbDefaults();
};

