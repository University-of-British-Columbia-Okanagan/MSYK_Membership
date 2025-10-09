import "tests/fixtures/equipment/setup";

import { getEquipmentMocks } from "tests/fixtures/equipment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  getLevel3ScheduleRestrictions,
  getLevel4UnavailableHours,
} from "~/models/equipment.server";

describe("equipment.server - Settings", () => {
  let db: any;
  let mockGetAdminSetting: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getEquipmentMocks();
    db = mocks.db;
    mockGetAdminSetting = mocks.mockGetAdminSetting;
  });

  describe("getLevel3ScheduleRestrictions", () => {
    it("returns default schedule when setting missing", async () => {
      mockGetAdminSetting.mockResolvedValue("");

      const result = await getLevel3ScheduleRestrictions();

      expect(result.Monday).toEqual({ start: 9, end: 17 });
    });

    it("parses JSON setting", async () => {
      mockGetAdminSetting.mockResolvedValue(
        JSON.stringify({ Monday: { start: 8, end: 20 } })
      );

      const result = await getLevel3ScheduleRestrictions();

      expect(result.Monday).toEqual({ start: 8, end: 20 });
    });

    it("falls back to default on parse error", async () => {
      mockGetAdminSetting.mockImplementation(() => {
        throw new Error("Bad JSON");
      });

      const result = await getLevel3ScheduleRestrictions();

      expect(result.Tuesday).toEqual({ start: 9, end: 17 });
    });
  });

  describe("getLevel4UnavailableHours", () => {
    it("returns default when setting missing", async () => {
      db.adminSettings.findUnique.mockResolvedValue(null);

      const result = await getLevel4UnavailableHours();

      expect(result).toEqual({ start: 0, end: 0 });
    });

    it("parses JSON when present", async () => {
      db.adminSettings.findUnique.mockResolvedValue({
        value: JSON.stringify({ start: 6, end: 9 }),
      });

      const result = await getLevel4UnavailableHours();

      expect(result).toEqual({ start: 6, end: 9 });
    });

    it("returns default on parse error", async () => {
      db.adminSettings.findUnique.mockResolvedValue({ value: "{" });

      const result = await getLevel4UnavailableHours();

      expect(result).toEqual({ start: 0, end: 0 });
    });
  });
});

