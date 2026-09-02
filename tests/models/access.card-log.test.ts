const createAccessDbMock = () => ({
  db: {
    accessCard: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    accessLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    equipment: {
      findFirst: jest.fn(),
    },
  },
});

type AccessDbMock = ReturnType<typeof createAccessDbMock>["db"];

jest.mock("~/utils/db.server", () => createAccessDbMock());

jest.mock("~/models/admin.server", () => ({
  getAdminSetting: jest.fn().mockResolvedValue(""),
}));

jest.mock("~/logging/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { clearAllMocks } from "tests/helpers/test-utils";
import {
  getAccessCardByUUID,
  getAccessCardByEmail,
  getAccessCardByBrivoCredentialId,
  getUserIdByAccessCard,
  hasPermissionForType,
  updateAccessCard,
} from "~/models/access_card.server";
import { logAccessEvent, getAccessLogs } from "~/models/accessLog.server";

const { db } = require("~/utils/db.server") as { db: AccessDbMock };

const rawCard = (overrides?: Record<string, unknown>) => ({
  id: "CARD-001",
  userId: 4,
  permissions: [0, 3],
  brivoCredentialId: "bc_1",
  brivoMobilePassId: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-02-01T00:00:00Z"),
  user: {
    firstName: "Sam",
    lastName: "Rivera",
    email: "sam@example.com",
  },
  ...overrides,
});

describe("access_card.server", () => {
  beforeEach(() => clearAllMocks());

  describe("getAccessCardByUUID", () => {
    it("flattens the user relation onto the returned card", async () => {
      db.accessCard.findUnique.mockResolvedValue(rawCard());

      const card = await getAccessCardByUUID("CARD-001");

      expect(card).toEqual({
        id: "CARD-001",
        userId: 4,
        userFirstName: "Sam",
        userLastName: "Rivera",
        userEmail: "sam@example.com",
        registeredAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
        permissions: [0, 3],
        brivoCredentialId: "bc_1",
        brivoMobilePassId: null,
      });
    });

    it("returns nulls for the user fields on an unassigned card", async () => {
      db.accessCard.findUnique.mockResolvedValue(
        rawCard({ userId: null, user: null })
      );

      const card = await getAccessCardByUUID("CARD-001");

      expect(card).toEqual(
        expect.objectContaining({
          userId: null,
          userFirstName: null,
          userEmail: null,
        })
      );
    });

    it("returns null when no card matches", async () => {
      db.accessCard.findUnique.mockResolvedValue(null);

      await expect(getAccessCardByUUID("nope")).resolves.toBeNull();
    });
  });

  describe("getAccessCardByBrivoCredentialId", () => {
    it("matches either the credential id or the mobile pass id", async () => {
      db.accessCard.findFirst.mockResolvedValue(rawCard());

      await getAccessCardByBrivoCredentialId("bc_1");

      expect(db.accessCard.findFirst.mock.calls[0][0].where).toEqual({
        OR: [{ brivoCredentialId: "bc_1" }, { brivoMobilePassId: "bc_1" }],
      });
    });

    it("returns null when nothing matches", async () => {
      db.accessCard.findFirst.mockResolvedValue(null);

      await expect(
        getAccessCardByBrivoCredentialId("unknown")
      ).resolves.toBeNull();
    });
  });

  describe("getAccessCardByEmail", () => {
    it("matches case-insensitively and returns every card for that user", async () => {
      db.accessCard.findMany.mockResolvedValue([
        rawCard({ id: "CARD-001" }),
        rawCard({ id: "CARD-002" }),
      ]);

      const cards = await getAccessCardByEmail("SAM@example.com");

      expect(db.accessCard.findMany.mock.calls[0][0].where).toEqual({
        user: { email: { equals: "SAM@example.com", mode: "insensitive" } },
      });
      expect(cards.map((c) => c.id)).toEqual(["CARD-001", "CARD-002"]);
    });

    it("returns an empty array when the user has no cards", async () => {
      db.accessCard.findMany.mockResolvedValue([]);

      await expect(getAccessCardByEmail("nobody@example.com")).resolves.toEqual(
        []
      );
    });
  });

  describe("getUserIdByAccessCard", () => {
    it("returns the linked user id", async () => {
      db.accessCard.findUnique.mockResolvedValue({ userId: 4 });

      await expect(getUserIdByAccessCard("CARD-001")).resolves.toBe(4);
    });

    it("returns null for an unknown or unassigned card", async () => {
      db.accessCard.findUnique.mockResolvedValue(null);
      await expect(getUserIdByAccessCard("nope")).resolves.toBeNull();

      db.accessCard.findUnique.mockResolvedValue({ userId: null });
      await expect(getUserIdByAccessCard("CARD-001")).resolves.toBeNull();
    });
  });

  describe("hasPermissionForType", () => {
    it("checks DOOR_PERMISSION_ID (0) for the door, case-insensitively", async () => {
      db.accessCard.findUnique.mockResolvedValue({ permissions: [0] });

      await expect(hasPermissionForType("CARD-001", "Door")).resolves.toBe(true);
      await expect(hasPermissionForType("CARD-001", "door")).resolves.toBe(true);
      expect(db.equipment.findFirst).not.toHaveBeenCalled();
    });

    it("denies the door when permission 0 is absent", async () => {
      db.accessCard.findUnique.mockResolvedValue({ permissions: [3, 5] });

      await expect(hasPermissionForType("CARD-001", "Door")).resolves.toBe(
        false
      );
    });

    it("resolves equipment by name and checks its id", async () => {
      db.accessCard.findUnique.mockResolvedValue({ permissions: [3] });
      db.equipment.findFirst.mockResolvedValue({ id: 3 });

      await expect(
        hasPermissionForType("CARD-001", "Laser Cutter")
      ).resolves.toBe(true);
      expect(db.equipment.findFirst).toHaveBeenCalledWith({
        where: { name: "Laser Cutter" },
        select: { id: true },
      });
    });

    it("denies when the card lacks that equipment id", async () => {
      db.accessCard.findUnique.mockResolvedValue({ permissions: [5] });
      db.equipment.findFirst.mockResolvedValue({ id: 3 });

      await expect(
        hasPermissionForType("CARD-001", "Laser Cutter")
      ).resolves.toBe(false);
    });

    it("denies when the equipment name is unknown", async () => {
      db.accessCard.findUnique.mockResolvedValue({ permissions: [3] });
      db.equipment.findFirst.mockResolvedValue(null);

      await expect(hasPermissionForType("CARD-001", "Ghost")).resolves.toBe(
        false
      );
    });

    it("denies when the card itself does not exist", async () => {
      db.accessCard.findUnique.mockResolvedValue(null);

      await expect(hasPermissionForType("nope", "Door")).resolves.toBe(false);
    });
  });

  describe("updateAccessCard", () => {
    it("links the card to the user found by email", async () => {
      db.user.findFirst.mockResolvedValue({ id: 4 });
      db.accessCard.upsert.mockResolvedValue({ id: "CARD-001" });

      await updateAccessCard("CARD-001", "SAM@example.com", [0, 3]);

      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "SAM@example.com", mode: "insensitive" } },
        select: { id: true },
      });
      expect(db.accessCard.upsert.mock.calls[0][0].update).toEqual(
        expect.objectContaining({ userId: 4, permissions: [0, 3] })
      );
    });

    it("throws when the email matches no user", async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(
        updateAccessCard("CARD-001", "ghost@example.com", [0])
      ).rejects.toThrow("No user found with the provided email.");
      expect(db.accessCard.upsert).not.toHaveBeenCalled();
    });

    it("clears permissions when the card is unassigned", async () => {
      // A card with no user must not keep door access.
      db.accessCard.upsert.mockResolvedValue({ id: "CARD-001" });

      await updateAccessCard("CARD-001", null, [0, 3]);

      expect(db.accessCard.upsert.mock.calls[0][0].update).toEqual(
        expect.objectContaining({ userId: null, permissions: [] })
      );
      expect(db.user.findFirst).not.toHaveBeenCalled();
    });

    it("passes Brivo identifiers through when supplied", async () => {
      db.user.findFirst.mockResolvedValue({ id: 4 });
      db.accessCard.upsert.mockResolvedValue({ id: "CARD-001" });

      await updateAccessCard("CARD-001", "sam@example.com", [0], {
        brivoCredentialId: "bc_9",
        brivoMobilePassId: "mp_9",
      });

      expect(db.accessCard.upsert.mock.calls[0][0].update).toEqual(
        expect.objectContaining({
          brivoCredentialId: "bc_9",
          brivoMobilePassId: "mp_9",
        })
      );
    });

    it("defaults Brivo identifiers to null on create", async () => {
      db.user.findFirst.mockResolvedValue({ id: 4 });
      db.accessCard.upsert.mockResolvedValue({ id: "CARD-001" });

      await updateAccessCard("CARD-001", "sam@example.com", [0]);

      expect(db.accessCard.upsert.mock.calls[0][0].create).toEqual(
        expect.objectContaining({
          brivoCredentialId: null,
          brivoMobilePassId: null,
        })
      );
    });
  });
});

describe("accessLog.server", () => {
  beforeEach(() => {
    clearAllMocks();
    db.accessLog.create.mockResolvedValue({});
    db.accessLog.findMany.mockResolvedValue([]);
    db.accessLog.count.mockResolvedValue(0);
  });

  describe("logAccessEvent", () => {
    it.each(["enter", "exit", "denied"])("accepts the %s state", async (state) => {
      await logAccessEvent("CARD-001", 4, "Door", state);

      expect(db.accessLog.create).toHaveBeenCalledWith({
        data: { accessCardId: "CARD-001", userId: 4, equipment: "Door", state },
      });
    });

    it("rejects any other state without writing", async () => {
      await expect(
        logAccessEvent("CARD-001", 4, "Door", "wandered_in")
      ).rejects.toThrow("Invalid state");
      expect(db.accessLog.create).not.toHaveBeenCalled();
    });

    it("allows a null user for an unassigned card", async () => {
      await logAccessEvent("CARD-001", null, "Door", "denied");

      expect(db.accessLog.create.mock.calls[0][0].data.userId).toBeNull();
    });
  });

  describe("getAccessLogs", () => {
    it("paginates newest first", async () => {
      await getAccessLogs({ page: 3, limit: 25 });

      expect(db.accessLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 25,
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("applies no filters when none are given", async () => {
      await getAccessLogs({ page: 1, limit: 10 });

      expect(db.accessLog.findMany.mock.calls[0][0].where).toEqual({});
    });

    it("filters equipment and card id by case-insensitive substring", async () => {
      await getAccessLogs({
        page: 1,
        limit: 10,
        equipment: "laser",
        accessCardId: "card",
      });

      expect(db.accessLog.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({
          equipment: { contains: "laser", mode: "insensitive" },
          accessCardId: { contains: "card", mode: "insensitive" },
        })
      );
    });

    it("ignores a whitespace-only email filter", async () => {
      await getAccessLogs({ page: 1, limit: 10, email: "   " });

      expect(db.accessLog.findMany.mock.calls[0][0].where.user).toBeUndefined();
    });

    it("filters by related user email when one is given", async () => {
      await getAccessLogs({ page: 1, limit: 10, email: "sam@" });

      expect(db.accessLog.findMany.mock.calls[0][0].where.user).toEqual({
        is: { email: { contains: "sam@", mode: "insensitive" } },
      });
    });

    it("supports an open-ended date range", async () => {
      await getAccessLogs({
        page: 1,
        limit: 10,
        startDate: "2026-01-01",
      });

      const createdAt = db.accessLog.findMany.mock.calls[0][0].where.createdAt;
      expect(createdAt.gte).toEqual(new Date("2026-01-01"));
      expect(createdAt.lte).toBeUndefined();
    });

    it("returns the rows alongside the unpaginated total", async () => {
      db.accessLog.findMany.mockResolvedValue([{ id: 1 }]);
      db.accessLog.count.mockResolvedValue(97);

      const result = await getAccessLogs({ page: 1, limit: 10 });

      expect(result).toEqual({ logs: [{ id: 1 }], total: 97 });
      // The count must use the same filters as the page query.
      expect(db.accessLog.count).toHaveBeenCalledWith({ where: {} });
    });
  });
});
