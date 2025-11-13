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

jest.mock("~/utils/email.server", () => ({
  sendMembershipEndedNoPaymentMethodEmail:
    mockSendMembershipEndedNoPaymentMethodEmail,
  sendMembershipPaymentReminderEmail: mockSendMembershipPaymentReminderEmail,
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
    mockCronSchedule: cronScheduleMock,
    scheduledJobs,
    stripeConstructorMock: Stripe as jest.Mock,
    stripePaymentIntentsCreateMock,
    resetScheduledJobs: () => {
      scheduledJobs.splice(0, scheduledJobs.length);
      cronScheduleMock.mockClear();
    },
    resetStripeMocks: () => {
      stripeConstructorMock.mockClear();
      stripePaymentIntentsCreateMock.mockClear();
    },
    resetEmailMocks: () => {
      mockSendMembershipEndedNoPaymentMethodEmail.mockClear();
      mockSendMembershipPaymentReminderEmail.mockClear();
    },
    resetAdminSettingMock: () => {
      mockGetAdminSetting.mockClear();
      mockGetAdminSetting.mockResolvedValue("5");
    },
  };
};

export const resetMembershipMocks = () => {
  stripeConstructorMock.mockClear();
  stripePaymentIntentsCreateMock.mockClear();
  mockGetAdminSetting.mockClear();
  mockGetAdminSetting.mockResolvedValue("5");
  mockSendMembershipEndedNoPaymentMethodEmail.mockClear();
  mockSendMembershipPaymentReminderEmail.mockClear();
  scheduledJobs.splice(0, scheduledJobs.length);
  cronScheduleMock.mockClear();
};

