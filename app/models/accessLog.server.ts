// app/models/accessLog.server.ts
import { db } from "../utils/db.server";

export async function logAccessEvent(
    accessCardId: string,
    userId: number | null,
    equipment: string,
    state: string,
) {
    if (state !== "enter" && state !== "exit") {
        throw new Error("Invalid state. Must be 'enter' or 'exit'.");
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

export async function getAccessLogs() {
  return await db.accessLog.findMany({
    select: {
      id: true,
      equipment: true,
      state: true,
      accessCardId: true,
      createdAt: true,
      user: {
        select: { email: true },
      },
    },
    orderBy: { id: "desc" },
  });
}
