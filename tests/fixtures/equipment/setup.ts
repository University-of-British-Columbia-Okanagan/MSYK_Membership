import { createDbMock } from "tests/helpers/db.mock";

jest.mock("~/utils/db.server", () => createDbMock());
jest.mock("~/utils/session.server", () => ({
  getUserId: jest.fn().mockResolvedValue("1"),
}));
// getAdminSetting is keyed — returning one blanket value breaks callers that JSON.parse
// the result. `level3_start_end_hours` in particular is parsed into a weekday map and then
// indexed by day name, so a scalar makes getLevel3ScheduleRestrictions() return a number
// and bookEquipment() crash on `dayRestriction.closed`. Mirror the production defaults.
export const ADMIN_SETTING_TEST_DEFAULTS: Record<string, string> = {
  equipment_visible_registrable_days: "7",
  gst_percentage: "5",
  max_number_equipment_slots_per_day: "4",
  max_number_equipment_slots_per_week: "14",
  level3_start_end_hours: JSON.stringify({
    Sunday: { start: 9, end: 17 },
    Monday: { start: 9, end: 17 },
    Tuesday: { start: 9, end: 17 },
    Wednesday: { start: 9, end: 17 },
    Thursday: { start: 9, end: 17 },
    Friday: { start: 9, end: 17 },
    Saturday: { start: 9, end: 17 },
  }),
};

jest.mock("~/models/admin.server", () => ({
  getAdminSetting: jest.fn(
    async (key: string, fallback?: string) =>
      ADMIN_SETTING_TEST_DEFAULTS[key] ?? fallback ?? ""
  ),
}));
jest.mock("~/utils/email.server", () => ({
  sendEquipmentConfirmationEmail: jest.fn(),
  sendEquipmentBulkConfirmationEmail: jest.fn(),
  sendEquipmentCancellationEmail: jest.fn(),
}));

// equipment.server imports stripe-sync.server, which constructs a Stripe client at
// module load from STRIPE_SECRET_KEY. That env var is absent under Jest, so the real
// module throws "Neither apiKey nor config.authenticator provided" and the whole
// suite fails to load. Mocking the sync service keeps the import cheap and lets
// tests assert that the non-blocking sync hooks fired.
jest.mock("~/services/stripe-sync.server", () => ({
  syncEquipmentToStripe: jest.fn().mockResolvedValue(undefined),
  archiveStripeProduct: jest.fn().mockResolvedValue(undefined),
}));

export { db } from "~/utils/db.server";

export const getEquipmentMocks = () => {
  const { db } = require("~/utils/db.server");
  const { getUserId } = require("~/utils/session.server");
  const { getAdminSetting } = require("~/models/admin.server");
  const {
    sendEquipmentConfirmationEmail,
    sendEquipmentBulkConfirmationEmail,
    sendEquipmentCancellationEmail,
  } = require("~/utils/email.server");
  const {
    syncEquipmentToStripe,
    archiveStripeProduct,
  } = require("~/services/stripe-sync.server");

  return {
    db,
    mockGetUserId: getUserId as jest.Mock,
    mockGetAdminSetting: getAdminSetting as jest.Mock,
    mockSendEquipmentConfirmationEmail:
      sendEquipmentConfirmationEmail as jest.Mock,
    mockSendEquipmentBulkConfirmationEmail:
      sendEquipmentBulkConfirmationEmail as jest.Mock,
    mockSendEquipmentCancellationEmail:
      sendEquipmentCancellationEmail as jest.Mock,
    mockSyncEquipmentToStripe: syncEquipmentToStripe as jest.Mock,
    mockArchiveStripeProduct: archiveStripeProduct as jest.Mock,
  };
};

