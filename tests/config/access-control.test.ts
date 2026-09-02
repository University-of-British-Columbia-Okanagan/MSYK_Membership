const mockGetAdminSetting = jest.fn();

jest.mock("~/models/admin.server", () => ({
  getAdminSetting: mockGetAdminSetting,
}));

const mockLoggerWarn = jest.fn();

jest.mock("~/logging/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: mockLoggerWarn,
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { clearAllMocks } from "tests/helpers/test-utils";
import {
  DOOR_PERMISSION_ID,
  requiresDoorPermission,
  getBrivoGroupsForRole,
} from "~/config/access-control";

describe("config/access-control", () => {
  const originalEnvGroups = process.env.BRIVO_ACCESS_GROUP_LEVEL4;

  beforeEach(() => {
    clearAllMocks();
    mockGetAdminSetting.mockReset();
    mockLoggerWarn.mockReset();
    delete process.env.BRIVO_ACCESS_GROUP_LEVEL4;
  });

  afterAll(() => {
    if (originalEnvGroups === undefined) {
      delete process.env.BRIVO_ACCESS_GROUP_LEVEL4;
    } else {
      process.env.BRIVO_ACCESS_GROUP_LEVEL4 = originalEnvGroups;
    }
  });

  it("pins DOOR_PERMISSION_ID to 0", () => {
    // ESP32 fob permissions are matched against this id; changing it silently
    // would re-map every stored accessCard.permissions entry.
    expect(DOOR_PERMISSION_ID).toBe(0);
  });

  describe("requiresDoorPermission", () => {
    it.each([
      [1, false],
      [2, false],
      [3, false],
      [4, true],
      [5, true],
    ])("role level %i -> %s", (level, expected) => {
      expect(requiresDoorPermission(level)).toBe(expected);
    });
  });

  describe("getBrivoGroupsForRole", () => {
    it("returns no groups below level 4 without consulting settings", async () => {
      await expect(getBrivoGroupsForRole(3)).resolves.toEqual([]);
      expect(mockGetAdminSetting).not.toHaveBeenCalled();
    });

    it("splits the comma-separated admin setting into group ids", async () => {
      mockGetAdminSetting.mockResolvedValue("100,200,300");

      await expect(getBrivoGroupsForRole(4)).resolves.toEqual([
        "100",
        "200",
        "300",
      ]);
    });

    it("trims whitespace and drops empty entries", async () => {
      mockGetAdminSetting.mockResolvedValue(" 100 , ,200,  ");

      await expect(getBrivoGroupsForRole(4)).resolves.toEqual(["100", "200"]);
    });

    it("passes the BRIVO_ACCESS_GROUP_LEVEL4 env var as the setting fallback", async () => {
      process.env.BRIVO_ACCESS_GROUP_LEVEL4 = "900";
      mockGetAdminSetting.mockImplementation(
        async (_key: string, fallback: string) => fallback
      );

      await expect(getBrivoGroupsForRole(4)).resolves.toEqual(["900"]);
      expect(mockGetAdminSetting).toHaveBeenCalledWith(
        "brivo_access_group_level4",
        "900"
      );
    });

    it("falls back to an empty string when neither setting nor env var is present", async () => {
      mockGetAdminSetting.mockImplementation(
        async (_key: string, fallback: string) => fallback
      );

      await expect(getBrivoGroupsForRole(4)).resolves.toEqual([]);
      expect(mockGetAdminSetting).toHaveBeenCalledWith(
        "brivo_access_group_level4",
        ""
      );
    });

    it("warns when a level 4 user qualifies but no groups are configured", async () => {
      mockGetAdminSetting.mockResolvedValue("");

      await getBrivoGroupsForRole(4);

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("brivo_access_group_level4 is not configured")
      );
    });

    it("does not warn when groups are configured", async () => {
      mockGetAdminSetting.mockResolvedValue("100");

      await getBrivoGroupsForRole(4);

      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });
  });
});
