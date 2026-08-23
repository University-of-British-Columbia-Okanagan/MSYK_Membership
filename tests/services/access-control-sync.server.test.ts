const createSyncDbMock = () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userMembership: {
      findFirst: jest.fn(),
    },
    accessCard: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
});

type SyncDbMock = ReturnType<typeof createSyncDbMock>["db"];

jest.mock("~/utils/db.server", () => createSyncDbMock());

const brivoClientMock = {
  isEnabled: jest.fn(),
  ensurePerson: jest.fn(),
  assignGroups: jest.fn(),
  ensureMobilePass: jest.fn(),
  revokeFromGroups: jest.fn(),
  revokeMobilePass: jest.fn(),
};

jest.mock("~/services/brivo.server", () => ({
  brivoClient: brivoClientMock,
}));

const mockGetBrivoGroupsForRole = jest.fn();

jest.mock("~/config/access-control", () => ({
  getBrivoGroupsForRole: (...args: unknown[]) =>
    (mockGetBrivoGroupsForRole as any)(...args),
  requiresDoorPermission: (roleLevel: number) => roleLevel >= 4,
}));

const loggerWarn = jest.fn();
const loggerError = jest.fn();

jest.mock("~/logging/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: loggerWarn,
    error: loggerError,
    debug: jest.fn(),
  },
}));

import { clearAllMocks } from "tests/helpers/test-utils";
import { syncUserDoorAccess } from "~/services/access-control-sync.server";

const { db } = require("~/utils/db.server") as { db: SyncDbMock };

const eligibleUser = (overrides?: Record<string, unknown>) => ({
  id: 1,
  firstName: "Sam",
  lastName: "Rivera",
  email: "sam@example.com",
  phone: "555-0100",
  roleLevel: 4,
  membershipStatus: "active",
  brivoPersonId: null,
  ...overrides,
});

describe("access-control-sync.server - syncUserDoorAccess", () => {
  beforeEach(() => {
    clearAllMocks();
    Object.values(brivoClientMock).forEach((m) => m.mockReset());
    mockGetBrivoGroupsForRole.mockReset().mockResolvedValue(["100"]);
    loggerWarn.mockReset();
    loggerError.mockReset();

    brivoClientMock.isEnabled.mockReturnValue(true);
    brivoClientMock.ensurePerson.mockResolvedValue({ id: "person_1" });
    brivoClientMock.assignGroups.mockResolvedValue(undefined);
    brivoClientMock.ensureMobilePass.mockResolvedValue("cred_1");
    brivoClientMock.revokeFromGroups.mockResolvedValue(undefined);
    brivoClientMock.revokeMobilePass.mockResolvedValue(undefined);

    db.user.findUnique.mockResolvedValue(eligibleUser());
    db.user.update.mockResolvedValue({});
    db.userMembership.findFirst.mockResolvedValue({ id: 10 });
    db.accessCard.findFirst.mockResolvedValue(null);
    db.accessCard.update.mockResolvedValue({});
    db.accessCard.updateMany.mockResolvedValue({ count: 0 });
  });

  describe("eligibility", () => {
    it("provisions access for an active level 4 member", async () => {
      await syncUserDoorAccess(1);

      expect(brivoClientMock.ensurePerson).toHaveBeenCalled();
      expect(brivoClientMock.assignGroups).toHaveBeenCalledWith("person_1", [
        "100",
      ]);
      expect(brivoClientMock.ensureMobilePass).toHaveBeenCalledWith(
        "person_1",
        "sam@example.com"
      );
    });

    it("requires an active membership, not merely a level 4 role", async () => {
      db.userMembership.findFirst.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(
        eligibleUser({ brivoPersonId: "person_1" })
      );

      await syncUserDoorAccess(1);

      expect(brivoClientMock.ensurePerson).not.toHaveBeenCalled();
      expect(brivoClientMock.revokeFromGroups).toHaveBeenCalled();
    });

    it("revokes access from a user whose membership was revoked", async () => {
      db.user.findUnique.mockResolvedValue(
        eligibleUser({ membershipStatus: "revoked", brivoPersonId: "person_1" })
      );

      await syncUserDoorAccess(1);

      expect(brivoClientMock.ensurePerson).not.toHaveBeenCalled();
      expect(brivoClientMock.revokeFromGroups).toHaveBeenCalledWith(
        "person_1",
        ["100"]
      );
      expect(brivoClientMock.revokeMobilePass).toHaveBeenCalledWith("person_1");
    });

    it.each([1, 2, 3])(
      "does not provision a level %i member",
      async (roleLevel) => {
        db.user.findUnique.mockResolvedValue(eligibleUser({ roleLevel }));

        await syncUserDoorAccess(1);

        expect(brivoClientMock.ensurePerson).not.toHaveBeenCalled();
      }
    );

    it("only counts a membership with status active", async () => {
      await syncUserDoorAccess(1);

      expect(db.userMembership.findFirst).toHaveBeenCalledWith({
        where: { userId: 1, status: "active" },
        select: { id: true },
      });
    });

    it("does nothing when the user does not exist", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await syncUserDoorAccess(999);

      expect(db.userMembership.findFirst).not.toHaveBeenCalled();
      expect(brivoClientMock.ensurePerson).not.toHaveBeenCalled();
    });
  });

  describe("graceful degradation", () => {
    it("returns without touching Brivo when the integration is not configured", async () => {
      brivoClientMock.isEnabled.mockReturnValue(false);

      await expect(syncUserDoorAccess(1)).resolves.toBeUndefined();

      expect(brivoClientMock.ensurePerson).not.toHaveBeenCalled();
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("warns when an unconfigured install has a user who should have access", async () => {
      brivoClientMock.isEnabled.mockReturnValue(false);

      await syncUserDoorAccess(1);

      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("BRIVO_* env vars are not configured"),
        { userId: 1 }
      );
    });

    it("stays silent for an ineligible user on an unconfigured install", async () => {
      brivoClientMock.isEnabled.mockReturnValue(false);
      db.user.findUnique.mockResolvedValue(eligibleUser({ roleLevel: 2 }));

      await syncUserDoorAccess(1);

      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it("warns and stops when no access groups are configured", async () => {
      mockGetBrivoGroupsForRole.mockResolvedValue([]);

      await syncUserDoorAccess(1);

      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("no Brivo access groups are configured"),
        { userId: 1 }
      );
      expect(brivoClientMock.ensurePerson).not.toHaveBeenCalled();
    });
  });

  describe("persistence", () => {
    it("stores the Brivo person id and clears any prior error on success", async () => {
      await syncUserDoorAccess(1);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          brivoPersonId: "person_1",
          brivoSyncError: null,
        }),
      });
    });

    it("writes the mobile pass id onto the user's access card when it changed", async () => {
      db.accessCard.findFirst.mockResolvedValue({
        id: "CARD-1",
        brivoMobilePassId: "old_cred",
      });

      await syncUserDoorAccess(1);

      expect(db.accessCard.update).toHaveBeenCalledWith({
        where: { id: "CARD-1" },
        data: { brivoMobilePassId: "cred_1" },
      });
    });

    it("leaves the access card alone when the mobile pass is unchanged", async () => {
      db.accessCard.findFirst.mockResolvedValue({
        id: "CARD-1",
        brivoMobilePassId: "cred_1",
      });

      await syncUserDoorAccess(1);

      expect(db.accessCard.update).not.toHaveBeenCalled();
    });

    it("clears the stored mobile pass id on revocation", async () => {
      db.user.findUnique.mockResolvedValue(
        eligibleUser({ membershipStatus: "revoked", brivoPersonId: "person_1" })
      );

      await syncUserDoorAccess(1);

      expect(db.accessCard.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, brivoMobilePassId: { not: null } },
        data: { brivoMobilePassId: null },
      });
    });

    it("skips revocation entirely for a user Brivo never knew about", async () => {
      db.user.findUnique.mockResolvedValue(
        eligibleUser({ roleLevel: 2, brivoPersonId: null })
      );

      await syncUserDoorAccess(1);

      expect(brivoClientMock.revokeFromGroups).not.toHaveBeenCalled();
      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("records the failure on the user instead of throwing", async () => {
      brivoClientMock.ensurePerson.mockRejectedValue(
        new Error("Brivo API timeout")
      );

      await expect(syncUserDoorAccess(1)).resolves.toBeUndefined();

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ brivoSyncError: "Brivo API timeout" }),
      });
      expect(loggerError).toHaveBeenCalled();
    });

    it("falls back to a generic message for a non-Error rejection", async () => {
      brivoClientMock.ensurePerson.mockRejectedValue("just a string");

      await syncUserDoorAccess(1);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          brivoSyncError: "Unknown Brivo sync error",
        }),
      });
    });
  });

  describe("caller-supplied user", () => {
    it("skips the database read when the full user is passed in", async () => {
      await syncUserDoorAccess(1, {
        user: eligibleUser() as any,
      });

      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(brivoClientMock.ensurePerson).toHaveBeenCalled();
    });

    it("still reads from the database when the supplied user is partial", async () => {
      await syncUserDoorAccess(1, { user: { roleLevel: 4 } });

      expect(db.user.findUnique).toHaveBeenCalled();
    });
  });
});
