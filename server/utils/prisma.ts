// A single, shared PrismaClient for the whole server.
//
// Anything exported from `server/utils/` is auto-imported inside our API
// routes, so we can just write `prisma.expense.findMany()` in a route without
// importing anything.
//
// Why the `globalThis` dance? In development Nuxt hot-reloads your server code
// on every save. Each reload would create a brand-new PrismaClient and open a
// new pool of database connections, and you'd quickly run out. Caching the
// client on `globalThis` means we reuse the same one across reloads.
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log queries + warnings while developing; stay quiet in production.
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
