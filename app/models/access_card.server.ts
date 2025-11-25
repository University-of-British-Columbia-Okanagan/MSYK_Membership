import { db } from "../utils/db.server";
import { DOOR_PERMISSION_ID } from "~/config/access-control";

export type AccessCard = {
  id: string;
  userId: number | null;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  registeredAt: Date | null;
  updatedAt: Date;
  permissions: number[];
  brivoCredentialId: string | null;
  brivoMobilePassId: string | null;
};

export async function getAccessCardByUUID(id: string): Promise<AccessCard | null> {
  const accessCard = await db.accessCard.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!accessCard) return null;

  return {
    id: accessCard.id,
    userId: accessCard.userId,
    userFirstName: accessCard.user?.firstName ?? null,
    userLastName: accessCard.user?.lastName ?? null,
    userEmail: accessCard.user?.email ?? null,
    registeredAt: accessCard.created_at,
    updatedAt: accessCard.updated_at,
    permissions: accessCard.permissions,
    brivoCredentialId: accessCard.brivoCredentialId,
    brivoMobilePassId: accessCard.brivoMobilePassId,
  };
}

export async function getAccessCardByBrivoCredentialId(
  credentialId: string,
): Promise<AccessCard | null> {
  const accessCard = await db.accessCard.findFirst({
    where: { brivoCredentialId: credentialId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!accessCard) return null;

  return {
    id: accessCard.id,
    userId: accessCard.userId,
    userFirstName: accessCard.user?.firstName ?? null,
    userLastName: accessCard.user?.lastName ?? null,
    userEmail: accessCard.user?.email ?? null,
    registeredAt: accessCard.created_at,
    updatedAt: accessCard.updated_at,
    permissions: accessCard.permissions,
    brivoCredentialId: accessCard.brivoCredentialId,
    brivoMobilePassId: accessCard.brivoMobilePassId,
  };
}

export async function updateAccessCard(
  id: string,
  userEmail: string | null,
  permissions: number[],
  extras?: {
    brivoCredentialId?: string | null;
    brivoMobilePassId?: string | null;
  },
) {
  let userId: number | null = null;
  let finalPermissions = permissions;

  if (userEmail) {
    // Try to find user by email
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });

    if (!user) {
      throw new Error("No user found with the provided email.");
    }

    userId = user.id;
  } else {
    userId = null;
    finalPermissions = [];
  }

  return db.accessCard.upsert({
    where: { id },
    update: {
      userId,
      permissions: finalPermissions,
      updated_at: new Date(),
      ...(extras ?? {}),
    },
    create: {
      id,
      userId,
      permissions: finalPermissions,
      created_at: new Date(),
      updated_at: new Date(),
      brivoCredentialId: extras?.brivoCredentialId ?? null,
      brivoMobilePassId: extras?.brivoMobilePassId ?? null,
    },
  });
}

export async function getUserIdByAccessCard(accessCardId: string) {
  const card = await db.accessCard.findUnique({
    where: { id: accessCardId },
    select: { userId: true },
  });

  return card?.userId ?? null;
}

/**
 * Checks if an access card has permission to use a given equipment type.
 *
 * Rules:
 * - "Door" corresponds to equipment ID 0.
 * - Other equipment types must be matched by name in Equipment table.
 */
export async function hasPermissionForType(accessCardId: string, type: string): Promise<boolean> {
  // Get the access card’s permissions
  const card = await db.accessCard.findUnique({
    where: { id: accessCardId },
    select: { permissions: true },
  });

  if (!card) return false;

  const { permissions } = card;

  if (type.toLowerCase() === "door") {
    // Special case for Door
    return permissions.includes(DOOR_PERMISSION_ID);
  }

  // Look up equipment by name
  const equipment = await db.equipment.findFirst({
    where: { name: type },
    select: { id: true },
  });

  if (!equipment) {
    // If equipment name not found, deny access
    return false;
  }

  return permissions.includes(equipment.id);
}