// app/services/users.server.ts
import { db } from "~/utils/db.server";

export async function getAllUsers() {
  return await db.user.findMany({
    select: {
      id: true,
      passcode: true,
      equipmentCertified: true,
      millCertified: true,
      cncCertified: true,
      welderCertified: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function updateCertifications(userId: string, certs: any) {
  return await db.user.update({
    where: { id: Number(userId) },
    data: {
      equipmentCertified: certs.equipment_certified ?? false,
      millCertified: certs.mill_certified ?? false,
      cncCertified: certs.cnc_certified ?? false,
      welderCertified: certs.welder_certified ?? false,
      updatedAt: new Date(),
    },
    select: { id: true },
  });
}

export async function checkAccess(pin: string) {
  const user = await db.user.findUnique({
    where: { passcode: Number(pin) },
    select: {
      id: true,
      passcode: true,
      equipmentCertified: true,
      millCertified: true,
      cncCertified: true,
      welderCertified: true,
    },
  });

  if (!user) return null;

  await db.accessLog.create({
    data: { userId: user.id, status: "granted", passcodeUsed: Number(pin) },
  });

  return user;
}

export async function getAccessLogs(limit = 50) {
  return await db.accessLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true } } },
  });
}
