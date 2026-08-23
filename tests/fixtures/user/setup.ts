const createUserDbMock = () => ({
  db: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    roleUser: {
      findUnique: jest.fn(),
    },
    userPaymentInformation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    userMembership: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
});

export type UserDbMock = ReturnType<typeof createUserDbMock>["db"];

jest.mock("~/utils/db.server", () => createUserDbMock());

// user.server calls syncUserDoorAccess on every role/permission change. The real
// service reaches for Brivo; here we only care that it was invoked.
const mockSyncUserDoorAccess = jest.fn().mockResolvedValue(undefined);

jest.mock("~/services/access-control-sync.server", () => ({
  syncUserDoorAccess: mockSyncUserDoorAccess,
}));

// user.server constructs a Stripe client at module load from STRIPE_SECRET_KEY,
// which is absent under Jest. Without this the suite fails to load entirely.
export const stripeCustomersCreateMock = jest
  .fn()
  .mockResolvedValue({ id: "cus_test" });
export const stripeTokensCreateMock = jest
  .fn()
  .mockResolvedValue({ id: "tok_test" });
export const stripePaymentMethodsAttachMock = jest.fn().mockResolvedValue({});
export const stripePaymentIntentsCreateMock = jest
  .fn()
  .mockResolvedValue({ id: "pi_test", status: "succeeded" });

const stripeConstructorMock = jest.fn().mockImplementation(() => ({
  customers: { create: stripeCustomersCreateMock },
  tokens: { create: stripeTokensCreateMock },
  paymentMethods: { attach: stripePaymentMethodsAttachMock },
  paymentIntents: { create: stripePaymentIntentsCreateMock },
}));

jest.mock("stripe", () => ({
  __esModule: true,
  default: stripeConstructorMock,
  Stripe: stripeConstructorMock,
}));

// node-cron is replaced with a recorder so the 15s role-level job can be invoked
// directly rather than waited on.
type ScheduledJob = { expression: string; handler: () => Promise<void> | void };

const scheduledJobs: ScheduledJob[] = [];

const cronScheduleMock = jest.fn(
  (expression: string, handler: () => Promise<void> | void) => {
    scheduledJobs.push({ expression, handler });
    return { stop: jest.fn(), start: jest.fn() };
  }
);

jest.mock("node-cron", () => ({
  __esModule: true,
  default: { schedule: cronScheduleMock },
}));

jest.mock("~/logging/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

export { db } from "~/utils/db.server";

export const getUserMocks = () => {
  const { db } = require("~/utils/db.server");
  const {
    syncUserDoorAccess,
  } = require("~/services/access-control-sync.server");

  return {
    db,
    mockSyncUserDoorAccess: syncUserDoorAccess as jest.Mock,
    cronScheduleMock,
    scheduledJobs,
    stripeCustomersCreateMock,
    stripeTokensCreateMock,
  };
};

export const resetUserMocks = () => {
  scheduledJobs.length = 0;
  cronScheduleMock.mockClear();
  mockSyncUserDoorAccess.mockClear();
  mockSyncUserDoorAccess.mockResolvedValue(undefined);
};
