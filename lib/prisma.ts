import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// The PrismaNeon adapter is only constructed when actually creating a new
// PrismaClient — i.e. only on the FIRST module load, not on every hot
// reload. With `||`, JS short-circuits: if globalForPrisma.prisma already
// exists, `new PrismaNeon(...)` on the right-hand side is never evaluated at
// all, so no extra connection gets opened. Previously the adapter was built
// unconditionally above this check, so every hot reload during a dev session
// silently opened (and leaked) one more connection to Neon, eventually
// exhausting the connection limit and making every query crawl.
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}