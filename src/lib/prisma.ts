import { PrismaClient } from "@prisma/client";

/**
 * Singleton del cliente de Prisma. En desarrollo, Next.js recarga módulos
 * en caliente y puede crear múltiples instancias del cliente; se reutiliza
 * una instancia global para evitar agotar las conexiones a la base de datos.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
