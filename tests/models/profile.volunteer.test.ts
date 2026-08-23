const createProfileDbMock = () => ({
  db: {
    volunteerTimetable: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    volunteer: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userMembership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    userPaymentInformation: {
      findUnique: jest.fn(),
    },
  },
});

type ProfileDbMock = ReturnType<typeof createProfileDbMock>["db"];

jest.mock("~/utils/db.server", () => createProfileDbMock());

import { clearAllMocks } from "tests/helpers/test-utils";
import {
  logVolunteerHours,
  checkVolunteerHourOverlap,
  updateVolunteerHourStatus,
  updateUserPhone,
  updateEmergencyContact,
  updateUserAvatar,
} from "~/models/profile.server";

const { db } = require("~/utils/db.server") as { db: ProfileDbMock };

const at = (iso: string) => new Date(iso);

describe("profile.server - volunteer hours", () => {
  beforeEach(() => {
    clearAllMocks();
  });

  describe("logVolunteerHours", () => {
    it("creates an entry that defaults to not-a-resubmission", async () => {
      db.volunteerTimetable.create.mockResolvedValue({ id: 1 });

      await logVolunteerHours(
        3,
        at("2026-05-01T09:00:00Z"),
        at("2026-05-01T12:00:00Z"),
        "Front desk"
      );

      expect(db.volunteerTimetable.create).toHaveBeenCalledWith({
        data: {
          userId: 3,
          startTime: at("2026-05-01T09:00:00Z"),
          endTime: at("2026-05-01T12:00:00Z"),
          description: "Front desk",
          isResubmission: false,
        },
      });
    });

    it("flags a resubmission when told to", async () => {
      db.volunteerTimetable.create.mockResolvedValue({ id: 2 });

      await logVolunteerHours(
        3,
        at("2026-05-01T09:00:00Z"),
        at("2026-05-01T12:00:00Z"),
        "Front desk",
        true
      );

      expect(
        db.volunteerTimetable.create.mock.calls[0][0].data.isResubmission
      ).toBe(true);
    });
  });

  describe("checkVolunteerHourOverlap", () => {
    const start = at("2026-05-01T10:00:00Z");
    const end = at("2026-05-01T12:00:00Z");

    it("reports an overlap when a matching entry exists", async () => {
      db.volunteerTimetable.findFirst.mockResolvedValue({ id: 1 });

      await expect(checkVolunteerHourOverlap(3, start, end)).resolves.toBe(true);
    });

    it("reports no overlap when nothing matches", async () => {
      db.volunteerTimetable.findFirst.mockResolvedValue(null);

      await expect(checkVolunteerHourOverlap(3, start, end)).resolves.toBe(
        false
      );
    });

    it("scopes the search to the requesting user", async () => {
      db.volunteerTimetable.findFirst.mockResolvedValue(null);

      await checkVolunteerHourOverlap(3, start, end);

      expect(db.volunteerTimetable.findFirst.mock.calls[0][0].where.userId).toBe(
        3
      );
    });

    it("checks all four ways two ranges can intersect", async () => {
      db.volunteerTimetable.findFirst.mockResolvedValue(null);

      await checkVolunteerHourOverlap(3, start, end);

      const or = db.volunteerTimetable.findFirst.mock.calls[0][0].where.OR;
      expect(or).toEqual([
        // new starts inside an existing entry
        { AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }] },
        // new ends inside an existing entry
        { AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }] },
        // new fully contains an existing entry
        { AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }] },
        // an existing entry fully contains new
        { AND: [{ startTime: { lte: start } }, { endTime: { gte: end } }] },
      ]);
    });

    it("counts denied entries as blocking for a first submission", async () => {
      db.volunteerTimetable.findFirst.mockResolvedValue(null);

      await checkVolunteerHourOverlap(3, start, end);

      expect(
        db.volunteerTimetable.findFirst.mock.calls[0][0].where.status
      ).toBeUndefined();
    });

    it("ignores denied entries when resubmitting", async () => {
      // Otherwise a user could never resubmit a corrected version of a denied
      // entry for the same time window — the denied row would block it.
      db.volunteerTimetable.findFirst.mockResolvedValue(null);

      await checkVolunteerHourOverlap(3, start, end, true);

      expect(db.volunteerTimetable.findFirst.mock.calls[0][0].where.status).toEqual(
        { not: "denied" }
      );
    });
  });

  describe("updateVolunteerHourStatus", () => {
    it("records the prior status alongside the new one", async () => {
      db.volunteerTimetable.findUnique.mockResolvedValue({ status: "pending" });
      db.volunteerTimetable.update.mockResolvedValue({ id: 1 });

      await updateVolunteerHourStatus(1, "approved");

      expect(db.volunteerTimetable.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: "approved",
          previousStatus: "pending",
        }),
      });
    });

    it("carries a denied status forward as previousStatus on resolve", async () => {
      db.volunteerTimetable.findUnique.mockResolvedValue({ status: "denied" });
      db.volunteerTimetable.update.mockResolvedValue({ id: 1 });

      await updateVolunteerHourStatus(1, "resolved");

      expect(
        db.volunteerTimetable.update.mock.calls[0][0].data.previousStatus
      ).toBe("denied");
    });

    it("assumes pending when the entry cannot be found", async () => {
      db.volunteerTimetable.findUnique.mockResolvedValue(null);
      db.volunteerTimetable.update.mockResolvedValue({ id: 1 });

      await updateVolunteerHourStatus(1, "approved");

      expect(
        db.volunteerTimetable.update.mock.calls[0][0].data.previousStatus
      ).toBe("pending");
    });

    it("stamps updatedAt", async () => {
      db.volunteerTimetable.findUnique.mockResolvedValue({ status: "pending" });
      db.volunteerTimetable.update.mockResolvedValue({ id: 1 });

      await updateVolunteerHourStatus(1, "approved");

      expect(
        db.volunteerTimetable.update.mock.calls[0][0].data.updatedAt
      ).toBeInstanceOf(Date);
    });
  });
});

describe("profile.server - profile updates", () => {
  beforeEach(() => {
    clearAllMocks();
    db.user.update.mockResolvedValue({ id: 1 });
  });

  it("updateUserPhone writes the phone number", async () => {
    await updateUserPhone(1, "555-0100");

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ phone: "555-0100" }),
      })
    );
  });

  it("updateUserAvatar writes the avatar url", async () => {
    await updateUserAvatar(1, "/uploads/avatar.png");

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ avatarUrl: "/uploads/avatar.png" }),
      })
    );
  });

  it("updateEmergencyContact writes all three contact fields", async () => {
    await updateEmergencyContact(
      1,
      "Alex Doe",
      "555-0111",
      "alex@example.com"
    );

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          emergencyContactName: "Alex Doe",
          emergencyContactPhone: "555-0111",
          emergencyContactEmail: "alex@example.com",
        }),
      })
    );
  });
});
