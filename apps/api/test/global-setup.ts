import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

// Push the Prisma schema to the (test) database before the suite runs. Uses
// whatever DATABASE_URL is configured — point this at a disposable database.
export default function setup(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set to run integration tests (point it at a test database).",
    );
  }
  execSync("pnpm prisma db push --skip-generate --accept-data-loss", {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}
