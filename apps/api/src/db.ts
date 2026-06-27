import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrlEnv } from "./lib/database-url.js";

// Single shared Prisma client, constructed lazily.
//
// Prisma validates the datasource env (DATABASE_URL) when the client is
// *constructed*. Constructing at module import means a missing DATABASE_URL
// crashes the whole process at load - on Vercel that surfaces as
// FUNCTION_INVOCATION_FAILED on every request, including DB-free routes like
// /health. By deferring construction to first use, the function boots cleanly:
// DB-free routes respond, and DB routes fail with a clean error (mapped to a
// 500/503 by the Fastify error handler) instead of taking down the function.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Normalize DATABASE_URL from platform-specific names (e.g. POSTGRES_PRISMA_URL)
  // before Prisma reads it.
  ensureDatabaseUrlEnv();
  const client = new PrismaClient({
    log: process.env.PRISMA_LOG === "true" ? ["query", "warn", "error"] : ["warn", "error"],
  });
  // Reuse across hot reloads / warm invocations to avoid exhausting the pool.
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

/** Construct (or reuse) the real client. Throws here, not at import time. */
export function getPrisma(): PrismaClient {
  return (globalForPrisma.prisma ??= createClient());
}

// A lazy proxy so existing `import { prisma }` call sites are unchanged while
// construction is deferred until the first property access.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
