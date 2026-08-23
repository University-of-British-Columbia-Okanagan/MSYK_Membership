const createPaymentDbMock = () => ({
  db: {
    userWorkshop: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    equipmentBooking: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    equipmentSlot: {
      updateMany: jest.fn(),
    },
    userMembership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    userPaymentInformation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
});

export type PaymentDbMock = ReturnType<typeof createPaymentDbMock>["db"];

jest.mock("~/utils/db.server", () => createPaymentDbMock());

// --- Stripe -----------------------------------------------------------------
// payment.server constructs the client at module load from STRIPE_SECRET_KEY,
// which is absent under Jest, so the real module would throw on import.
export const stripePaymentIntentsCreateMock = jest.fn();
export const stripeRefundsCreateMock = jest.fn();
export const stripeCheckoutSessionsCreateMock = jest.fn();
export const stripePaymentMethodsAttachMock = jest.fn();
export const stripePaymentMethodsDetachMock = jest.fn();
export const stripeCustomersCreateMock = jest.fn();

const stripeConstructorMock = jest.fn().mockImplementation(() => ({
  paymentIntents: { create: stripePaymentIntentsCreateMock },
  refunds: { create: stripeRefundsCreateMock },
  checkout: { sessions: { create: stripeCheckoutSessionsCreateMock } },
  paymentMethods: {
    attach: stripePaymentMethodsAttachMock,
    detach: stripePaymentMethodsDetachMock,
  },
  customers: { create: stripeCustomersCreateMock },
}));

jest.mock("stripe", () => ({
  __esModule: true,
  Stripe: stripeConstructorMock,
  default: stripeConstructorMock,
}));

// --- Collaborating modules --------------------------------------------------
export const mockGetSavedPaymentMethod = jest.fn();

jest.mock("~/models/user.server", () => ({
  getSavedPaymentMethod: mockGetSavedPaymentMethod,
  getOrCreateStripeCustomer: jest.fn().mockResolvedValue("cus_test"),
}));

export const mockGetAdminSetting = jest.fn().mockResolvedValue("5");

jest.mock("~/models/admin.server", () => ({
  getAdminSetting: mockGetAdminSetting,
}));

jest.mock("~/models/workshop.server", () => ({
  getWorkshopById: jest.fn(),
  getWorkshopOccurrence: jest.fn(),
  getWorkshopOccurrencesByConnectId: jest.fn(),
  registerForWorkshop: jest.fn(),
  registerUserForAllOccurrences: jest.fn(),
  getWorkshopPriceVariation: jest.fn(),
}));

jest.mock("~/models/membership.server", () => ({
  getMembershipPlanById: jest.fn(),
  calculateProratedUpgradeAmount: jest.fn(),
}));

export const mockSyncUserDoorAccess = jest.fn().mockResolvedValue(undefined);

jest.mock("~/services/access-control-sync.server", () => ({
  syncUserDoorAccess: mockSyncUserDoorAccess,
}));

export { db } from "~/utils/db.server";

export const getPaymentMocks = () => {
  const { db } = require("~/utils/db.server");
  return {
    db,
    stripePaymentIntentsCreateMock,
    stripeRefundsCreateMock,
    stripeCheckoutSessionsCreateMock,
    stripePaymentMethodsDetachMock,
    mockGetSavedPaymentMethod,
    mockGetAdminSetting,
    mockSyncUserDoorAccess,
  };
};

export const resetPaymentMocks = () => {
  [
    stripePaymentIntentsCreateMock,
    stripeRefundsCreateMock,
    stripeCheckoutSessionsCreateMock,
    stripePaymentMethodsAttachMock,
    stripePaymentMethodsDetachMock,
    stripeCustomersCreateMock,
    mockGetSavedPaymentMethod,
    mockSyncUserDoorAccess,
  ].forEach((m) => m.mockReset());

  mockGetAdminSetting.mockReset();
  mockGetAdminSetting.mockResolvedValue("5");
  mockSyncUserDoorAccess.mockResolvedValue(undefined);
};
