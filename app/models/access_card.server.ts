import { db } from "../utils/db.server";

export type AccessCard = {
  id: string;
  userId: number | null;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  registeredAt: Date | null;
  updatedAt: Date;
  permissions: number[];
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
  };
}
 
export async function updateAccessCard(
  id: string,
  userEmail: string | null,
  permissions: number[]
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
    },
    create: {
      id,
      userId,
      permissions: finalPermissions,
      created_at: new Date(),
      updated_at: new Date(),
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