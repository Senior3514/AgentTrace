// Build-time migration step for Vercel. Resolves the database URL from whatever
// env var the platform set, then runs `prisma migrate deploy`. Non-fatal: if no
// database is configured yet, it logs and exits 0 so the build still succeeds.

import { execSync } from "node:child_process";
import { resolveDatabaseUrl } from "./src/lib/database-url.js";

const url = resolveDatabaseUrl();
if (!url) {
  console.log("AgentTrace: no database env var found - skipping migrations.");
  process.exit(0);
}

process.env.DATABASE_URL = url;
try {
  execSync("prisma migrate deploy --schema=../../prisma/schema.prisma", { stdio: "inherit" });
  console.log("AgentTrace: migrations applied.");
} catch (err) {
  console.log(`AgentTrace: migrate deploy failed (continuing): ${(err as Error).message}`);
}
