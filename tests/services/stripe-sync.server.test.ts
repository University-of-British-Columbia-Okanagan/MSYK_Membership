const createStripeSyncDbMock = () => ({
  db: {
    workshop: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    membershipPlan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    equipment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
});

type StripeSyncDbMock = ReturnType<typeof createStripeSyncDbMock>["db"];

jest.mock("~/utils/db.server", () => createStripeSyncDbMock());

const productsCreateMock = jest.fn();
const productsUpdateMock = jest.fn();

const stripeConstructorMock = jest.fn().mockImplementation(() => ({
  products: { create: productsCreateMock, update: productsUpdateMock },
}));

jest.mock("stripe", () => ({
  __esModule: true,
  default: stripeConstructorMock,
  Stripe: stripeConstructorMock,
}));

import { clearAllMocks } from "tests/helpers/test-utils";
import {
  syncWorkshopToStripe,
  syncMembershipPlanToStripe,
  syncEquipmentToStripe,
  archiveStripeProduct,
  bulkSyncToStripe,
} from "~/services/stripe-sync.server";

const { db } = require("~/utils/db.server") as { db: StripeSyncDbMock };

describe("stripe-sync.server", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    clearAllMocks();
    productsCreateMock.mockReset().mockResolvedValue({ id: "prod_new" });
    productsUpdateMock.mockReset().mockResolvedValue({});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  describe("syncWorkshopToStripe", () => {
    it("creates a product and stores the id when not yet linked", async () => {
      db.workshop.findUnique.mockResolvedValue({
        id: 7,
        name: "Laser Cutting",
        description: "Intro session",
        stripeProductId: null,
      });

      await syncWorkshopToStripe(7);

      expect(productsCreateMock).toHaveBeenCalledWith({
        name: "Laser Cutting",
        description: "Intro session",
        metadata: { portal_type: "workshop", portal_id: "7" },
      });
      expect(db.workshop.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { stripeProductId: "prod_new" },
      });
    });

    it("updates in place and does not rewrite the id when already linked", async () => {
      db.workshop.findUnique.mockResolvedValue({
        id: 7,
        name: "Laser Cutting v2",
        description: null,
        stripeProductId: "prod_existing",
      });

      await syncWorkshopToStripe(7);

      expect(productsUpdateMock).toHaveBeenCalledWith("prod_existing", {
        name: "Laser Cutting v2",
        description: undefined,
        metadata: { portal_type: "workshop", portal_id: "7" },
      });
      expect(productsCreateMock).not.toHaveBeenCalled();
      expect(db.workshop.update).not.toHaveBeenCalled();
    });

    it("does nothing when the workshop does not exist", async () => {
      db.workshop.findUnique.mockResolvedValue(null);

      await syncWorkshopToStripe(404);

      expect(productsCreateMock).not.toHaveBeenCalled();
      expect(productsUpdateMock).not.toHaveBeenCalled();
    });

    it("swallows Stripe errors so callers stay non-blocking", async () => {
      // Model hooks call this with .catch(); it must never reject and take a
      // create/update transaction down with it.
      db.workshop.findUnique.mockResolvedValue({
        id: 7,
        name: "Laser Cutting",
        stripeProductId: null,
      });
      productsCreateMock.mockRejectedValue(new Error("stripe down"));

      await expect(syncWorkshopToStripe(7)).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe("syncMembershipPlanToStripe", () => {
    it("uses the plan title as the product name and tags it as membership", async () => {
      db.membershipPlan.findUnique.mockResolvedValue({
        id: 3,
        title: "24/7 Access",
        description: "All hours",
        stripeProductId: null,
      });

      await syncMembershipPlanToStripe(3);

      expect(productsCreateMock).toHaveBeenCalledWith({
        name: "24/7 Access",
        description: "All hours",
        metadata: { portal_type: "membership", portal_id: "3" },
      });
    });

    it("does nothing when the plan does not exist", async () => {
      db.membershipPlan.findUnique.mockResolvedValue(null);

      await syncMembershipPlanToStripe(404);

      expect(productsCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("syncEquipmentToStripe", () => {
    it("tags the product as equipment", async () => {
      db.equipment.findUnique.mockResolvedValue({
        id: 5,
        name: "3D Printer",
        description: "Prusa",
        stripeProductId: null,
      });

      await syncEquipmentToStripe(5);

      expect(productsCreateMock).toHaveBeenCalledWith({
        name: "3D Printer",
        description: "Prusa",
        metadata: { portal_type: "equipment", portal_id: "5" },
      });
    });

    it("does nothing when the equipment does not exist", async () => {
      db.equipment.findUnique.mockResolvedValue(null);

      await syncEquipmentToStripe(404);

      expect(productsCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("archiveStripeProduct", () => {
    it("deactivates rather than deleting, since Stripe keeps paid-for products", async () => {
      await archiveStripeProduct("prod_x");

      expect(productsUpdateMock).toHaveBeenCalledWith("prod_x", {
        active: false,
      });
    });

    it("swallows errors so a delete is not blocked by Stripe being down", async () => {
      productsUpdateMock.mockRejectedValue(new Error("stripe down"));

      await expect(archiveStripeProduct("prod_x")).resolves.toBeUndefined();
    });
  });

  describe("bulkSyncToStripe", () => {
    beforeEach(() => {
      db.workshop.findMany.mockResolvedValue([]);
      db.membershipPlan.findMany.mockResolvedValue([]);
      db.equipment.findMany.mockResolvedValue([]);
    });

    it("only picks up unlinked records by default", async () => {
      await bulkSyncToStripe();

      expect(db.workshop.findMany).toHaveBeenCalledWith({
        where: { stripeProductId: null },
      });
      expect(db.workshop.updateMany).not.toHaveBeenCalled();
    });

    it("clears every stored id first and then re-syncs everything", async () => {
      await bulkSyncToStripe(true);

      expect(db.workshop.updateMany).toHaveBeenCalledWith({
        data: { stripeProductId: null },
      });
      expect(db.membershipPlan.updateMany).toHaveBeenCalledWith({
        data: { stripeProductId: null },
      });
      expect(db.equipment.updateMany).toHaveBeenCalledWith({
        data: { stripeProductId: null },
      });
      // With ids cleared the selection is unfiltered.
      expect(db.workshop.findMany).toHaveBeenCalledWith({ where: {} });
    });

    it("reports a per-category count", async () => {
      db.workshop.findMany.mockResolvedValue([
        { id: 1, name: "W1", stripeProductId: null },
        { id: 2, name: "W2", stripeProductId: null },
      ]);
      db.membershipPlan.findMany.mockResolvedValue([
        { id: 1, title: "M1", stripeProductId: null },
      ]);
      db.equipment.findMany.mockResolvedValue([
        { id: 1, name: "E1", stripeProductId: null },
      ]);
      db.workshop.findUnique.mockImplementation(async ({ where }: any) => ({
        id: where.id,
        name: `W${where.id}`,
        stripeProductId: null,
      }));
      db.membershipPlan.findUnique.mockResolvedValue({
        id: 1,
        title: "M1",
        stripeProductId: null,
      });
      db.equipment.findUnique.mockResolvedValue({
        id: 1,
        name: "E1",
        stripeProductId: null,
      });

      const result = await bulkSyncToStripe();

      expect(result).toEqual(
        expect.objectContaining({
          workshopsSynced: 2,
          membershipPlansSynced: 1,
          equipmentSynced: 1,
        })
      );
    });

    it("returns zero counts and no errors when there is nothing to sync", async () => {
      const result = await bulkSyncToStripe();

      expect(result).toEqual({
        workshopsSynced: 0,
        membershipPlansSynced: 0,
        equipmentSynced: 0,
        errors: [],
      });
    });
  });
});
