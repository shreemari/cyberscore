import { PrismaClient, type Prisma } from '@prisma/client';
import { env, isProd } from './env';

// Prisma singleton — don't create a new client on every hot-reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['error', 'warn'],
    datasources: {
      db: { url: env.DATABASE_URL },
    },
  });

if (!isProd) globalForPrisma.prisma = prisma;

// ============================================================
// Tenant-scoped transaction helper
// ============================================================
// Every API request that touches tenant data MUST wrap its Prisma
// work in this helper. It opens a transaction and sets the
// `app.current_org_id` session variable so RLS policies apply.
//
// Usage:
//   const result = await withTenant(orgId, async (tx) => {
//     return tx.response.findMany(...);
//   });
//
// If you forget to use this, RLS will return zero rows — which is
// the safe failure mode (never the other direction).
export async function withTenant<T>(
  orgId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(name, value, is_local=true) scopes to this transaction only.
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}

// System / worker context — for cross-tenant operations (seed, analytics,
// abandonment jobs, scheduled benchmark refresh). Bypasses RLS.
// NEVER call this from an API request handler.
export async function withBypassRls<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    return fn(tx);
  });
}

export type { Prisma };
