// app/models/accessLog.server.ts
import { db } from "../utils/db.server";

export async function logAccessEvent(
    accessCardId: string,
    userId: number | null,
    equipment: string,
    state: string,
) {
    if (state !== "enter" && state !== "exit" && state !== "denied") {
        throw new Error("Invalid state. Must be 'enter' or 'exit' or 'denied'.");
    }

    await db.accessLog.create({
        data: {
        accessCardId,
        userId,
        equipment,
        state,
        },
    });
}

export async function getAccessLogs({
  page,
  limit,
  equipment,
  accessCardId,
  email,
  startDate,
  endDate,
}: {
  page: number;
  limit: number;
  equipment?: string | null;
  accessCardId?: string | null;
  email?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (equipment) {
    where.equipment = { contains: equipment, mode: "insensitive" };
  }

  if (accessCardId) {
    where.accessCardId = { contains: accessCardId, mode: "insensitive" };
  }

  if (email?.trim()) {
  where.user = {
    is: {
      email: { contains: email, mode: "insensitive" },
    },
  };
}


  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    db.accessLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true,
        equipment: true,
        state: true,
        accessCardId: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    db.accessLog.count({ where }),
  ]);

  return { logs, total };
}
