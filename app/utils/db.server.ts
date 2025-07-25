import { PrismaClient } from "@prisma/client";
import { singleton } from "./singleton.server";

/**
 * Singleton database connection instance using Prisma Client
 * Ensures only one database connection exists throughout the application lifecycle
 * @returns PrismaClient - The shared database connection instance
 */
export const db = singleton("prisma", () => new PrismaClient());
