import { logger } from "~/logging/logger";
import { getAdminSetting } from "~/models/admin.server";

export const DOOR_PERMISSION_ID = 0;

export function requiresDoorPermission(roleLevel: number): boolean {
  return roleLevel >= 4;
}

export async function getBrivoGroupsForRole(roleLevel: number): Promise<string[]> {
  if (roleLevel < 4) {
    return [];
  }

  const groupSetting = await getAdminSetting(
    "brivo_access_group_level4",
    process.env.BRIVO_ACCESS_GROUP_LEVEL4 ?? "",
  );

  const groups = groupSetting
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (groups.length === 0) {
    logger.warn(
      "Level 4 users qualify for 24/7 access but brivo_access_group_level4 is not configured.",
    );
  }

  return groups;
}


