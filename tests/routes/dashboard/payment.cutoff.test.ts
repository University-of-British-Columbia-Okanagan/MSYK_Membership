// session.server throws at import time if SESSION_SECRET is unset, and payment.tsx
// pulls it in transitively — so this side-effect import must stay on the first line.
import "tests/fixtures/session/setup";

import { getUser, getRoleUser } from "~/utils/session.server";
import { getSavedPaymentMethod, getUserById } from "~/models/user.server";
import {
  getWorkshopById,
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
  getWorkshopPriceVariation,
  checkWorkshopCapacity,
  checkMultiDayWorkshopCapacity,
} from "~/models/workshop.server";
import { getAdminSetting } from "~/models/admin.server";
import { loader } from "~/routes/dashboard/payment";

// payment.tsx constructs a Stripe client at module load from STRIPE_SECRET_KEY,
// which is absent under Jest, so the real module would throw on import.
jest.mock("stripe", () => {
  const stripeConstructorMock = jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn() } },
  }));
  return {
    __esModule: true,
    Stripe: stripeConstructorMock,
    default: stripeConstructorMock,
  };
});

jest.mock("~/utils/session.server");
jest.mock("~/models/user.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/membership.server");
jest.mock("~/models/admin.server");
jest.mock("~/logging/logger");

const mockGetUser = getUser as jest.Mock;
const mockGetRoleUser = getRoleUser as jest.Mock;
const mockGetUserById = getUserById as jest.Mock;
const mockGetSavedPaymentMethod = getSavedPaymentMethod as jest.Mock;
const mockGetWorkshopById = getWorkshopById as jest.Mock;
const mockGetWorkshopOccurrence = getWorkshopOccurrence as jest.Mock;
const mockGetWorkshopOccurrencesByConnectId =
  getWorkshopOccurrencesByConnectId as jest.Mock;
const mockGetWorkshopPriceVariation = getWorkshopPriceVariation as jest.Mock;
const mockCheckWorkshopCapacity = checkWorkshopCapacity as jest.Mock;
const mockCheckMultiDayWorkshopCapacity =
  checkMultiDayWorkshopCapacity as jest.Mock;
const mockGetAdminSetting = getAdminSetting as jest.Mock;

const MINUTE = 60 * 1000;
const REGISTRATION_CUTOFF_MINUTES = 60;

/**
 * The four workshop URL shapes the payment loader accepts. Each must enforce
 * Workshop.registrationCutoff — the loader is the only server-side gate, since
 * neither quickCheckout() nor paymentsuccess.tsx re-checks it.
 */
const URL_SHAPES: Array<{
  name: string;
  params: Record<string, string>;
  isMultiDay: boolean;
}> = [
  {
    name: "single occurrence, no price variation",
    params: { workshopId: "1", occurrenceId: "10" },
    isMultiDay: false,
  },
  {
    name: "single occurrence, with price variation",
    params: { workshopId: "1", occurrenceId: "10", variationId: "5" },
    isMultiDay: false,
  },
  {
    name: "multi-day, no price variation",
    params: { workshopId: "1", connectId: "3" },
    isMultiDay: true,
  },
  {
    name: "multi-day, with price variation",
    params: { workshopId: "1", connectId: "3", variationId: "5" },
    isMultiDay: true,
  },
];

/**
 * Builds an occurrence that starts `startsInMinutes` from now and always ends in
 * the future, so the loader's "occurrence already ended" guard never fires and
 * mask the cutoff result we are actually asserting on.
 */
function buildOccurrence(startsInMinutes: number) {
  const now = Date.now();
  return {
    id: 10,
    workshopId: 1,
    startDate: new Date(now + startsInMinutes * MINUTE),
    endDate: new Date(now + (startsInMinutes + 180) * MINUTE),
    status: "active",
    connectId: null,
  };
}

function primeMocks(startsInMinutes: number, isMultiDay: boolean) {
  const occurrence = buildOccurrence(startsInMinutes);

  mockGetUser.mockResolvedValue({ id: 1, email: "user@example.com", roleLevel: 3 });
  mockGetRoleUser.mockResolvedValue({ userId: 1, roleId: 1, roleName: "User" });
  mockGetUserById.mockResolvedValue({
    id: 1,
    roleLevel: 3,
    allowLevel4: false,
    membershipStatus: "active",
  });
  mockGetSavedPaymentMethod.mockResolvedValue(null);

  mockGetWorkshopById.mockResolvedValue({
    id: 1,
    name: "Laser Cutting Basics",
    price: 30,
    location: "Makerspace YK",
    capacity: 15,
    type: "workshop",
    registrationCutoff: REGISTRATION_CUTOFF_MINUTES,
    stripeProductId: null,
  });
  mockGetWorkshopOccurrence.mockResolvedValue(occurrence);
  mockGetWorkshopOccurrencesByConnectId.mockResolvedValue([occurrence]);
  mockGetWorkshopPriceVariation.mockResolvedValue({
    id: 5,
    workshopId: 1,
    name: "Student",
    price: 20,
    description: "Student pricing",
    capacity: 5,
    status: "active",
  });
  mockCheckWorkshopCapacity.mockResolvedValue({ hasCapacity: true });
  mockCheckMultiDayWorkshopCapacity.mockResolvedValue({ hasCapacity: true });
  mockGetAdminSetting.mockResolvedValue("5");

  return occurrence;
}

async function runLoader(params: Record<string, string>) {
  const request = new Request("http://localhost:5173/dashboard/payment");
  return loader({ request, params, context: {} } as any);
}

describe("payment loader — registration cutoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each(URL_SHAPES)("$name", ({ params, isMultiDay }) => {
    it("redirects away when the registration cutoff has passed", async () => {
      // Starts in 30 minutes with a 60-minute cutoff, so registration closed 30
      // minutes ago. The occurrence has not started, so only the cutoff can reject it.
      primeMocks(30, isMultiDay);

      let thrown: unknown;
      try {
        await runLoader(params);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Response);
      const response = thrown as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard/user");
    });

    it("loads the payment page when the cutoff has not passed", async () => {
      // Starts in 3 hours with a 60-minute cutoff, so registration is still open.
      primeMocks(180, isMultiDay);

      const result = await runLoader(params);

      expect(result).toEqual(
        expect.objectContaining({
          isMultiDayWorkshop: isMultiDay,
          gstPercentage: 5,
        })
      );
    });
  });

  it("treats a zero or missing cutoff as no restriction", async () => {
    primeMocks(1, false);
    mockGetWorkshopById.mockResolvedValue({
      id: 1,
      name: "Laser Cutting Basics",
      price: 30,
      location: "Makerspace YK",
      capacity: 15,
      type: "workshop",
      registrationCutoff: 0,
      stripeProductId: null,
    });

    const result = await runLoader({ workshopId: "1", occurrenceId: "10" });

    expect(result).toEqual(
      expect.objectContaining({ isMultiDayWorkshop: false })
    );
  });
});
