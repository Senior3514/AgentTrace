// Resolve the Postgres connection string from whichever env var the platform
// provides. Vercel's Postgres/Neon/Prisma-Postgres integrations each set a
// different variable name (rarely the plain DATABASE_URL Prisma expects), so we
// accept the common ones and normalize to DATABASE_URL.

const CANDIDATE_VARS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL", // Vercel Postgres (pooled, Prisma-recommended)
  "POSTGRES_URL", // Vercel Postgres (pooled)
  "PRISMA_DATABASE_URL", // Prisma Postgres
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

/** First non-empty Postgres URL found among the known env var names. */
export function resolveDatabaseUrl(): string | undefined {
  for (const key of CANDIDATE_VARS) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Ensure `process.env.DATABASE_URL` is set from one of the known variables, so
 * Prisma (which reads `env("DATABASE_URL")`) connects regardless of which name
 * the hosting platform used. No-op if DATABASE_URL is already set.
 */
export function ensureDatabaseUrlEnv(): void {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) return;
  const url = resolveDatabaseUrl();
  if (url) process.env.DATABASE_URL = url;
}
