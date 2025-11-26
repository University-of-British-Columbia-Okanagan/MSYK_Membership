import { DOOR_PERMISSION_ID, getBrivoGroupsForRole, requiresDoorPermission } from "~/config/access-control";
import { logger } from "~/logging/logger";
import { brivoClient } from "~/services/brivo.server";
import { db } from "~/utils/db.server";

type UserForSync = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleLevel: number;
  membershipStatus: string;
  brivoPersonId: string | null;
};

type SyncOptions = {
  user?: Partial<UserForSync> & {
    membershipStatus?: string;
    roleLevel?: number;
  };
};

function mergeDoorPermission(
  current: number[],
  shouldHaveDoor: boolean,
): number[] {
  const hasDoor = current.includes(DOOR_PERMISSION_ID);

  if (shouldHaveDoor && !hasDoor) {
    return [...current, DOOR_PERMISSION_ID];
  }

  if (!shouldHaveDoor && hasDoor) {
    return current.filter((perm) => perm !== DOOR_PERMISSION_ID);
  }

  return current;
}

async function syncAccessCards(userId: number, shouldHaveDoor: boolean) {
  const accessCardModel = (db as any).accessCard;
  if (!accessCardModel?.findMany || !accessCardModel?.update) {
    return;
  }

  type AccessCardRecord = { id: string; permissions: number[] };

  const cards = (await accessCardModel.findMany({
    where: { userId },
    select: { id: true, permissions: true },
  })) as AccessCardRecord[];

  await Promise.all(
    cards.map(async (card) => {
      const nextPermissions = mergeDoorPermission(card.permissions, shouldHaveDoor);
      const changed =
        nextPermissions.length !== card.permissions.length ||
        nextPermissions.some((perm, index) => perm !== card.permissions[index]);
      if (!changed) return;

      await accessCardModel.update({
        where: { id: card.id },
        data: { permissions: nextPermissions },
      });
    }),
  );
}

async function getAllConfiguredGroups(): Promise<string[]> {
  return getBrivoGroupsForRole(4);
}

export async function syncUserDoorAccess(userId: number, options?: SyncOptions) {
  const provided = options?.user;
  const hasFullUser =
    provided &&
    provided.firstName !== undefined &&
    provided.lastName !== undefined &&
    provided.email !== undefined &&
    provided.membershipStatus !== undefined &&
    provided.roleLevel !== undefined;

  const user =
    hasFullUser
      ? (provided as UserForSync & { membershipStatus: string; roleLevel: number })
      : await db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            roleLevel: true,
            membershipStatus: true,
            brivoPersonId: true,
          },
        });

  if (!user) {
    return;
  }

  const activeMembership = await db.userMembership.findFirst({
    where: { userId, status: "active" },
    select: { id: true },
  });

  const shouldHaveDoor =
    activeMembership !== null &&
    user.membershipStatus !== "revoked" &&
    requiresDoorPermission(user.roleLevel);

  await syncAccessCards(userId, shouldHaveDoor);

  if (!brivoClient.isEnabled()) {
    if (shouldHaveDoor) {
      logger.warn(
        "User requires Brivo door access but BRIVO_* env vars are not configured.",
        { userId },
      );
    }
    return;
  }

  const groups = shouldHaveDoor
    ? await getBrivoGroupsForRole(user.roleLevel)
    : await getAllConfiguredGroups();

  if (shouldHaveDoor && groups.length === 0) {
    logger.warn(
      "User qualifies for 24/7 access but no Brivo access groups are configured.",
      { userId },
    );
    return;
  }

  try {
    if (shouldHaveDoor) {
      const person = await brivoClient.ensurePerson(user as UserForSync);
      await brivoClient.assignGroups(person.id, groups);

      const mobilePassCredentialId = await brivoClient.ensureMobilePass(
        person.id,
        user.email,
      );

      const primaryCard = await db.accessCard.findFirst({
        where: { userId: user.id },
        select: { id: true, brivoMobilePassId: true },
      });

      if (primaryCard && primaryCard.brivoMobilePassId !== mobilePassCredentialId) {
        await db.accessCard.update({
          where: { id: primaryCard.id },
          data: { brivoMobilePassId: mobilePassCredentialId },
        });
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          brivoPersonId: person.id,
          brivoLastSyncedAt: new Date(),
          brivoSyncError: null,
        },
      });
    } else if (user.brivoPersonId) {
      await brivoClient.revokeFromGroups(user.brivoPersonId, groups);
      await brivoClient.revokeMobilePass(user.brivoPersonId);

      await db.accessCard.updateMany({
        where: { userId: user.id, brivoMobilePassId: { not: null } },
        data: { brivoMobilePassId: null },
      });

      await db.user.update({
        where: { id: user.id },
        data: { brivoLastSyncedAt: new Date(), brivoSyncError: null },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Brivo sync error";
    logger.error("Failed to sync Brivo door access", {
      userId: user.id,
      error,
    });
    await db.user.update({
      where: { id: user.id },
      data: {
        brivoSyncError: message,
        brivoLastSyncedAt: new Date(),
      },
    });
  }
}


