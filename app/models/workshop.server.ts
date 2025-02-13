import { db } from "../utils/db.server";

export async function getWorkshops() {
    const workshops = await db.workshop.findMany({
      orderBy: {
        id: "asc",
      },
    });
    return workshops;
  }