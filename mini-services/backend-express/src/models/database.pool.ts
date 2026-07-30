/**
 * Cliente Prisma compartido con el frontend Next.js.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaExpress: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prismaExpress ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaExpress = db;
}
