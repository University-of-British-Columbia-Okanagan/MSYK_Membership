jest.mock("~/utils/session.server", () => ({ getUser: jest.fn(), getRoleUser: jest.fn() }));
jest.mock("~/models/equipment.server", () => {
  class EquipmentBookingError extends Error {}
  return {
    EquipmentBookingError,
    getEquipmentSlotsWithStatus: jest.fn(),
    getLevel3ScheduleRestrictions: jest.fn(),
    getLevel4UnavailableHours: jest.fn(),
    hasUserCompletedEquipmentPrerequisites: jest.fn(),
    prepareEquipmentBooking: jest.fn(),
    createEquipmentCheckout: jest.fn(),
    bookEquipmentBulkByTimes: jest.fn(),
  };
});
jest.mock("~/models/admin.server", () => ({ getAdminSetting: jest.fn(), getPlannedClosures: jest.fn() }));
jest.mock("~/models/payment.server", () => ({ createCheckoutSession: jest.fn() }));
jest.mock("~/models/user.server", () => ({ getSavedPaymentMethod: jest.fn() }));
jest.mock("~/logging/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { getUser, getRoleUser } from "~/utils/session.server";
import {
  EquipmentBookingError,
  bookEquipmentBulkByTimes,
  createEquipmentCheckout,
  prepareEquipmentBooking,
} from "~/models/equipment.server";
import { createCheckoutSession } from "~/models/payment.server";
import { action } from "~/routes/dashboard/equipmentbooking";

const SLOT = "2026-11-17T05:00:00.000Z|2026-11-17T05:30:00.000Z";
const HELD = [{ startTime: "2026-11-17T05:00:00.000Z", endTime: "2026-11-17T05:30:00.000Z" }];

function post(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost/dashboard/equipmentbooking/1", { method: "POST", body: fd });
}

describe("equipment booking action: the server holds, prices and books the slots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: 6, roleLevel: 4 });
    (getRoleUser as jest.Mock).mockResolvedValue({ userId: 6, roleId: 1, roleName: "user" });
    (prepareEquipmentBooking as jest.Mock).mockResolvedValue({
      equipment: { id: 1, name: "Laser Cutter", price: 10 },
      slots: HELD,
      amount: 10,
    });
    (createEquipmentCheckout as jest.Mock).mockResolvedValue({ id: "chk_1" });
    (createCheckoutSession as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.test/s" }))
    );
  });

  it("refuses to start a checkout for slots the member may not book", async () => {
    (prepareEquipmentBooking as jest.Mock).mockRejectedValue(
      new EquipmentBookingError("Level 4 members cannot book between 10 PM and 6 AM.")
    );

    const res = (await action({ request: post({ equipmentId: "1", slotTimes: JSON.stringify([SLOT]) }) })) as Response;

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ errors: { message: "Level 4 members cannot book between 10 PM and 6 AM." } });
    expect(createEquipmentCheckout).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("validates the member's own slots, holds them, and pays for what it holds", async () => {
    const slotTimes = JSON.stringify([SLOT]);

    const res = (await action({
      request: post({ equipmentId: "1", slotTimes, slotCount: "99", price: "0", userId: "1" }),
    })) as Response;

    expect(prepareEquipmentBooking).toHaveBeenCalledWith(6, 1, slotTimes);
    expect(createEquipmentCheckout).toHaveBeenCalledWith(6, 1, HELD, 10);
    const [request, userId] = (createCheckoutSession as jest.Mock).mock.calls[0];
    expect(userId).toBe(6);
    expect(await request.json()).toEqual({ equipmentCheckoutId: "chk_1" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://checkout.stripe.test/s");
  });

  it("books free equipment straight away, with no Stripe checkout", async () => {
    (prepareEquipmentBooking as jest.Mock).mockResolvedValue({
      equipment: { id: 1, name: "Sewing Machine", price: 0 },
      slots: HELD,
      amount: 0,
    });

    const res = (await action({ request: post({ equipmentId: "1", slotTimes: JSON.stringify([SLOT]) }) })) as Response;

    expect(bookEquipmentBulkByTimes).toHaveBeenCalledWith(6, 1, HELD);
    expect(createEquipmentCheckout).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(res.headers.get("Location")).toBe("/dashboard/payment/success?quick_checkout=true&type=equipment&free=1");
  });

  it("rejects a checkout that does not say which slots it is for", async () => {
    const res = (await action({ request: post({ equipmentId: "1", slotCount: "1" }) })) as Response;

    expect(res.status).toBe(400);
    expect(prepareEquipmentBooking).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    (getUser as jest.Mock).mockResolvedValue(null);

    const res = (await action({ request: post({ equipmentId: "1", slotTimes: JSON.stringify([SLOT]) }) })) as Response;

    expect(res.status).toBe(401);
    expect(prepareEquipmentBooking).not.toHaveBeenCalled();
  });
});
