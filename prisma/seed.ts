// Seed a realistic set of agent runs and finalize them into signed receipts.
// Run with: pnpm seed   (idempotent - clears existing data, then re-seeds)
import { prisma } from "../apps/api/src/db.js";
import { resetDemoData } from "../apps/api/src/services/demo.js";

async function main(): Promise<void> {
  console.log("Seeding AgentTrace…");
  const summary = await resetDemoData();

  console.log("Seed complete:");
  console.log(`  owner:  ${summary.ownerId}`);
  console.log(`  agents: ${summary.agents}`);
  console.log(`  runs:   ${summary.runs.length}`);
  for (const r of summary.runs) {
    console.log(
      `   - ${r.runExternalId.padEnd(34)} ${r.riskLevel.padEnd(8)} ` +
        `flags=${r.riskFlags}  receipt=${r.receiptHash.slice(0, 16)}…  (${r.scenario})`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
