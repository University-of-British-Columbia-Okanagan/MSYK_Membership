import "tests/fixtures/user/setup";

import { getUserMocks, resetUserMocks } from "tests/fixtures/user/setup";
import type { UserDbMock } from "tests/fixtures/user/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import { startRoleLevelSyncCron } from "~/models/user.server";

/**
 * Shapes a row the way startRoleLevelSyncCron's select returns it.
 *
 * The query pre-filters both relations, so presence in the array already means
 * "passed orientation" / "membership counted as current" — the cron only checks
 * lengths and the needAdminPermission flag.
 */
const userRow = (opts: {
  id?: number;
  roleLevel: number;
  allowLevel4?: boolean;
  passedOrientation?: boolean;
  memberships?: Array<{ needAdminPermission: boolean }>;
}) => ({
  id: opts.id ?? 1,
  roleLevel: opts.roleLevel,
  allowLevel4: opts.allowLevel4 ?? false,
  userWorkshops: opts.passedOrientation ? [{ id: 1 }] : [],
  userMemberships: (opts.memberships ?? []).map((m) => ({
    membershipPlan: { needAdminPermission: m.needAdminPermission },
  })),
});

const standardPlan = { needAdminPermission: false };
const adminPermissionPlan = { needAdminPermission: true };

describe("user.server - role level sync cron", () => {
  let db: UserDbMock;
  let mockSyncUserDoorAccess: jest.Mock;
  let scheduledJobs: Array<{ expression: string; handler: () => Promise<void> | void }>;
  let cronScheduleMock: jest.Mock;

  /** Registers the cron and runs its handler once. */
  const runSync = async () => {
    startRoleLevelSyncCron();
    await scheduledJobs[scheduledJobs.length - 1].handler();
  };

  beforeEach(() => {
    clearAllMocks();
    resetUserMocks();
    const mocks = getUserMocks();
    db = mocks.db;
    mockSyncUserDoorAccess = mocks.mockSyncUserDoorAccess;
    scheduledJobs = mocks.scheduledJobs;
    cronScheduleMock = mocks.cronScheduleMock as unknown as jest.Mock;
    db.user.update.mockResolvedValue({});
  });

  it("registers on a 15 second schedule", () => {
    startRoleLevelSyncCron();

    expect(cronScheduleMock).toHaveBeenCalledWith(
      "*/15 * * * * *",
      expect.any(Function)
    );
  });

  describe("level calculation", () => {
    // Each case states what the user has, and the level the AND chain should produce.
    const cases: Array<{
      name: string;
      row: ReturnType<typeof userRow>;
      expected: number;
    }> = [
      {
        name: "registered only",
        row: userRow({ roleLevel: 0, passedOrientation: false }),
        expected: 1,
      },
      {
        name: "orientation, no membership",
        row: userRow({ roleLevel: 0, passedOrientation: true }),
        expected: 2,
      },
      {
        name: "orientation + standard membership",
        row: userRow({
          roleLevel: 0,
          passedOrientation: true,
          memberships: [standardPlan],
        }),
        expected: 3,
      },
      {
        name: "orientation + admin-permission plan + allowLevel4",
        row: userRow({
          roleLevel: 0,
          passedOrientation: true,
          allowLevel4: true,
          memberships: [adminPermissionPlan],
        }),
        expected: 4,
      },
      {
        name: "admin-permission plan but allowLevel4 not granted stops at 3",
        row: userRow({
          roleLevel: 0,
          passedOrientation: true,
          allowLevel4: false,
          memberships: [adminPermissionPlan],
        }),
        expected: 3,
      },
      {
        name: "allowLevel4 granted but plan does not require admin permission stops at 3",
        row: userRow({
          roleLevel: 0,
          passedOrientation: true,
          allowLevel4: true,
          memberships: [standardPlan],
        }),
        expected: 3,
      },
      {
        name: "membership without orientation falls all the way back to 1",
        row: userRow({
          roleLevel: 0,
          passedOrientation: false,
          memberships: [standardPlan],
        }),
        expected: 1,
      },
      {
        name: "allowLevel4 without orientation or membership is still 1",
        row: userRow({
          roleLevel: 0,
          passedOrientation: false,
          allowLevel4: true,
          memberships: [],
        }),
        expected: 1,
      },
      {
        name: "one of several memberships carrying the flag is enough for 4",
        row: userRow({
          roleLevel: 0,
          passedOrientation: true,
          allowLevel4: true,
          memberships: [standardPlan, adminPermissionPlan],
        }),
        expected: 4,
      },
    ];

    it.each(cases)("$name -> level $expected", async ({ row, expected }) => {
      db.user.findMany.mockResolvedValue([row]);

      await runSync();

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { roleLevel: expected },
      });
    });
  });

  describe("drift correction", () => {
    it("writes nothing when the stored level is already correct", async () => {
      db.user.findMany.mockResolvedValue([
        userRow({ roleLevel: 2, passedOrientation: true }),
      ]);

      await runSync();

      expect(db.user.update).not.toHaveBeenCalled();
      expect(mockSyncUserDoorAccess).not.toHaveBeenCalled();
    });

    it("resyncs door access whenever it corrects a level", async () => {
      db.user.findMany.mockResolvedValue([
        userRow({ id: 42, roleLevel: 1, passedOrientation: true }),
      ]);

      await runSync();

      expect(mockSyncUserDoorAccess).toHaveBeenCalledWith(42);
    });

    it("demotes as well as promotes", async () => {
      db.user.findMany.mockResolvedValue([
        // Stored as 4, but has neither orientation nor membership any more.
        userRow({ id: 8, roleLevel: 4, allowLevel4: true }),
      ]);

      await runSync();

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 8 },
        data: { roleLevel: 1 },
      });
    });

    it("corrects every drifted user in one pass and leaves correct ones alone", async () => {
      db.user.findMany.mockResolvedValue([
        userRow({ id: 1, roleLevel: 1, passedOrientation: true }), // -> 2
        userRow({ id: 2, roleLevel: 2, passedOrientation: true }), // already right
        userRow({
          id: 3,
          roleLevel: 1,
          passedOrientation: true,
          memberships: [standardPlan],
        }), // -> 3
      ]);

      await runSync();

      expect(db.user.update).toHaveBeenCalledTimes(2);
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { roleLevel: 2 },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { roleLevel: 3 },
      });
      expect(mockSyncUserDoorAccess).toHaveBeenCalledTimes(2);
    });
  });

  describe("query shape", () => {
    it("counts only passed orientations and current memberships", async () => {
      db.user.findMany.mockResolvedValue([]);

      await runSync();

      const select = db.user.findMany.mock.calls[0][0].select;
      expect(select.userWorkshops.where).toEqual({
        result: { equals: "passed", mode: "insensitive" },
        workshop: { type: { equals: "orientation", mode: "insensitive" } },
      });
      expect(select.userMemberships.where).toEqual({
        status: { in: ["active", "ending", "cancelled"] },
      });
    });
  });

  describe("resilience", () => {
    it("swallows a database error so the cron keeps running", async () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      db.user.findMany.mockRejectedValue(new Error("connection lost"));

      await expect(runSync()).resolves.not.toThrow();

      consoleError.mockRestore();
    });
  });
});
