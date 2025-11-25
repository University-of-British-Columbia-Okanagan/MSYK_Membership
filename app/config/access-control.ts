import { logger } from "~/logging/logger";

export const DOOR_PERMISSION_ID = 0;

type RoleDoorRule = {
  minRoleLevel: number;
  brivoGroupEnv: string | undefined;
};

const roleRules: RoleDoorRule[] = [
  {
    minRoleLevel: 4,
    brivoGroupEnv: process.env.BRIVO_ACCESS_GROUP_LEVEL4,
  },
];

export function requiresDoorPermission(roleLevel: number): boolean {
  return roleLevel >= 4;
}

export function getBrivoGroupsForRole(roleLevel: number): string[] {
  const groups: string[] = [];

  for (const rule of roleRules) {
    if (roleLevel >= rule.minRoleLevel && rule.brivoGroupEnv) {
      groups.push(
        ...rule.brivoGroupEnv
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    }
  }

  if (roleLevel >= 4 && groups.length === 0) {
    logger.warn(
      "Level 4 users qualify for 24/7 access but BRIVO_ACCESS_GROUP_LEVEL4 is not configured.",
    );
  }

  return Array.from(new Set(groups));
}


