import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDatabaseUrlEnv, resolveDatabaseUrl } from "../src/lib/database-url.js";

const VARS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "PRISMA_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

describe("database URL resolution", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
    for (const v of VARS) delete process.env[v];
  });
  afterEach(() => {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it("prefers DATABASE_URL when present", () => {
    process.env.DATABASE_URL = "postgres://a";
    process.env.POSTGRES_PRISMA_URL = "postgres://b";
    expect(resolveDatabaseUrl()).toBe("postgres://a");
  });

  it("falls back to Vercel/Neon variable names", () => {
    process.env.POSTGRES_PRISMA_URL = "postgres://pooled";
    expect(resolveDatabaseUrl()).toBe("postgres://pooled");
  });

  it("ensureDatabaseUrlEnv normalizes a fallback into DATABASE_URL", () => {
    process.env.POSTGRES_URL = "postgres://vercel";
    ensureDatabaseUrlEnv();
    expect(process.env.DATABASE_URL).toBe("postgres://vercel");
  });

  it("returns undefined when no database variable is set", () => {
    expect(resolveDatabaseUrl()).toBeUndefined();
  });
});
