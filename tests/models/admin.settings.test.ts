const createAdminDbMock = () => ({
  db: {
    adminSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    workshop: {
      update: jest.fn(),
    },
  },
});

type AdminDbMock = ReturnType<typeof createAdminDbMock>["db"];

jest.mock("~/utils/db.server", () => createAdminDbMock());

import { clearAllMocks } from "tests/helpers/test-utils";
import {
  getAdminSetting,
  updateAdminSetting,
  getWorkshopVisibilityDays,
  getEquipmentVisibilityDays,
  getPastWorkshopVisibility,
  getPlannedClosures,
  updatePlannedClosures,
  updateWorkshopCutoff,
} from "~/models/admin.server";

const { db } = require("~/utils/db.server") as { db: AdminDbMock };

describe("admin.server - settings", () => {
  beforeEach(() => {
    clearAllMocks();
    db.adminSettings.upsert.mockResolvedValue({});
  });

  describe("getAdminSetting", () => {
    it("returns the stored value when the key exists", async () => {
      db.adminSettings.findUnique.mockResolvedValue({ value: "12" });

      await expect(getAdminSetting("gst_percentage")).resolves.toBe("12");
      expect(db.adminSettings.findUnique).toHaveBeenCalledWith({
        where: { key: "gst_percentage" },
      });
    });

    it("falls back to the supplied default when the key is absent", async () => {
      db.adminSettings.findUnique.mockResolvedValue(null);

      await expect(getAdminSetting("gst_percentage", "5")).resolves.toBe("5");
    });

    it("defaults to an empty string when no fallback is given", async () => {
      db.adminSettings.findUnique.mockResolvedValue(null);

      await expect(getAdminSetting("never_set")).resolves.toBe("");
    });

    it("keeps a stored empty string rather than substituting the default", async () => {
      // ?? only replaces null/undefined, so "" is a real configured value.
      db.adminSettings.findUnique.mockResolvedValue({ value: "" });

      await expect(getAdminSetting("level3_start_end_hours", "fallback")).resolves.toBe(
        ""
      );
    });
  });

  describe("updateAdminSetting", () => {
    it("upserts the key with a generated description when none is supplied", async () => {
      await updateAdminSetting("gst_percentage", "7");

      expect(db.adminSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: "gst_percentage" },
          create: expect.objectContaining({
            key: "gst_percentage",
            value: "7",
            description: "Setting for gst_percentage",
          }),
        })
      );
    });

    it("does not overwrite an existing description when none is supplied", async () => {
      await updateAdminSetting("gst_percentage", "7");

      const update = db.adminSettings.upsert.mock.calls[0][0].update;
      expect(update).not.toHaveProperty("description");
      expect(update.value).toBe("7");
    });

    it("writes the description through when one is supplied", async () => {
      await updateAdminSetting("gst_percentage", "7", "Sales tax");

      const call = db.adminSettings.upsert.mock.calls[0][0];
      expect(call.update.description).toBe("Sales tax");
      expect(call.create.description).toBe("Sales tax");
    });
  });

  describe("visibility helpers", () => {
    it.each([
      ["workshop_visibility_days", 60, getWorkshopVisibilityDays],
      ["equipment_visible_registrable_days", 7, getEquipmentVisibilityDays],
      ["past_workshop_visibility", 180, getPastWorkshopVisibility],
    ])(
      "%s falls back to %i when unset",
      async (_key, expected, fn: () => Promise<number>) => {
        db.adminSettings.findUnique.mockResolvedValue(null);

        await expect(fn()).resolves.toBe(expected);
      }
    );

    it("parses the configured value as an integer", async () => {
      db.adminSettings.findUnique.mockResolvedValue({ value: "30" });

      await expect(getWorkshopVisibilityDays()).resolves.toBe(30);
    });

    it("reads equipment visibility from equipment_visible_registrable_days", async () => {
      db.adminSettings.findUnique.mockResolvedValue({ value: "14" });

      await expect(getEquipmentVisibilityDays()).resolves.toBe(14);
      expect(db.adminSettings.findUnique).toHaveBeenCalledWith({
        where: { key: "equipment_visible_registrable_days" },
      });
    });
  });

  describe("planned closures", () => {
    it("returns an empty list when the key is unset", async () => {
      db.adminSettings.findUnique.mockResolvedValue(null);

      await expect(getPlannedClosures()).resolves.toEqual([]);
    });

    it("returns an empty list when the stored value is blank", async () => {
      db.adminSettings.findUnique.mockResolvedValue({ value: "" });

      await expect(getPlannedClosures()).resolves.toEqual([]);
    });

    it("revives the stored ISO strings back into Date objects", async () => {
      db.adminSettings.findUnique.mockResolvedValue({
        value: JSON.stringify([
          {
            id: 1,
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-08T00:00:00.000Z",
          },
        ]),
      });

      const closures = await getPlannedClosures();

      expect(closures).toHaveLength(1);
      expect(closures[0].startDate).toBeInstanceOf(Date);
      expect(closures[0].startDate.toISOString()).toBe(
        "2026-07-01T00:00:00.000Z"
      );
    });

    it("degrades to an empty list rather than throwing on malformed JSON", async () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      db.adminSettings.findUnique.mockResolvedValue({ value: "{not json" });

      await expect(getPlannedClosures()).resolves.toEqual([]);

      consoleError.mockRestore();
    });

    it("serialises closures to JSON on update", async () => {
      const closures = [
        { id: 1, startDate: "2026-07-01", endDate: "2026-07-08" },
      ];

      await updatePlannedClosures(closures);

      const call = db.adminSettings.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ key: "planned_closures" });
      expect(JSON.parse(call.update.value)).toEqual(closures);
    });
  });

  describe("updateWorkshopCutoff", () => {
    it("writes the cutoff minutes onto the workshop", async () => {
      db.workshop.update.mockResolvedValue({ id: 3, registrationCutoff: 120 });

      await updateWorkshopCutoff(3, 120);

      expect(db.workshop.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 3 },
          data: expect.objectContaining({ registrationCutoff: 120 }),
        })
      );
    });
  });
});
