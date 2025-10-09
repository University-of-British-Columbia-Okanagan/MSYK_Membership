import "tests/fixtures/equipment/setup";

import { getEquipmentMocks } from "tests/fixtures/equipment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  createEquipmentCancellation,
  getAllEquipmentCancellations,
  updateEquipmentCancellationResolved,
  getEquipmentCancellationsByStatus,
} from "~/models/equipment.server";

describe("equipment.server - Cancellations", () => {
  let db: any;

  beforeEach(() => {
    clearAllMocks();
    db = getEquipmentMocks().db;
  });

  describe("createEquipmentCancellation", () => {
    it("creates cancellation without payment intent", async () => {
      db.equipmentCancelledBooking.create.mockResolvedValue({ id: 1 });

      const result = await createEquipmentCancellation({
        userId: 1,
        equipmentId: 1,
        paymentIntentId: null,
        totalSlotsBooked: 2,
        slotsToCancel: 1,
        totalPricePaid: 100,
        cancelledSlotTimes: [
          {
            startTime: new Date("2025-12-01T10:00:00Z"),
            endTime: new Date("2025-12-01T10:30:00Z"),
            slotId: 5,
          },
        ],
      });

      expect(result.id).toBe(1);
      expect(db.equipmentCancelledBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priceToRefund: 50,
          slotsRefunded: 1,
        }),
      });
    });

    it("creates cancellation using original totals with payment intent", async () => {
      db.equipmentCancelledBooking.findMany.mockResolvedValue([
        {
          totalSlotsBooked: 4,
          totalPricePaid: 200,
          slotsRefunded: 1,
        },
      ]);
      db.equipmentCancelledBooking.create.mockResolvedValue({ id: 2 });

      await createEquipmentCancellation({
        userId: 1,
        equipmentId: 1,
        paymentIntentId: "pi_123",
        totalSlotsBooked: 2,
        slotsToCancel: 2,
        totalPricePaid: 100,
        cancelledSlotTimes: [
          {
            startTime: new Date("2025-12-01T10:00:00Z"),
            endTime: new Date("2025-12-01T10:30:00Z"),
            slotId: 5,
          },
        ],
      });

      expect(db.equipmentCancelledBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalSlotsBooked: 4,
          totalPricePaid: 200,
          slotsRefunded: 2,
          priceToRefund: 100,
        }),
      });
    });
  });

  describe("getAllEquipmentCancellations", () => {
    it("returns cancellations with relations", async () => {
      db.equipmentCancelledBooking.findMany.mockResolvedValue([
        {
          id: 10,
          paymentIntentId: "pi_123",
          user: { firstName: "John" },
          equipment: { name: "Laser" },
        },
      ]);

      const result = await getAllEquipmentCancellations();

      // stripePaymentIntentId is mapped from paymentIntentId in getAllEquipmentCancellations
      // But equipment cancellations function returns raw records; adjust to assert raw field
      expect(result[0].paymentIntentId).toBe("pi_123");
      expect(db.equipmentCancelledBooking.findMany).toHaveBeenCalled();
    });
  });

  describe("updateEquipmentCancellationResolved", () => {
    it("updates resolved flag", async () => {
      db.equipmentCancelledBooking.update.mockResolvedValue({
        id: 5,
        resolved: true,
      });

      const result = await updateEquipmentCancellationResolved(5, true);

      expect(result.resolved).toBe(true);
      expect(db.equipmentCancelledBooking.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { resolved: true },
      });
    });
  });

  describe("getEquipmentCancellationsByStatus", () => {
    it("filters cancellations by resolved status", async () => {
      db.equipmentCancelledBooking.findMany.mockResolvedValue([
        { id: 1, resolved: false },
      ]);

      const result = await getEquipmentCancellationsByStatus(false);

      expect(result).toHaveLength(1);
      expect(db.equipmentCancelledBooking.findMany).toHaveBeenCalledWith({
        where: { resolved: false },
        include: expect.any(Object),
        orderBy: { cancellationDate: "desc" },
      });
    });
  });
});

