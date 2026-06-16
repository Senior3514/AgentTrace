import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db.js";
import { resetDemoData, seedDemoData, isDatabaseEmpty } from "../src/services/demo.js";
import { getReceipt, getRunVerification } from "../src/services/finalize.js";

async function wipe() {
  await prisma.riskFlag.deleteMany();
  await prisma.attestation.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.event.deleteMany();
  await prisma.run.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.owner.deleteMany();
}

describe("demo seed dataset", () => {
  beforeAll(wipe);

  it("creates 1 owner, 2 agents and 4 finalized, verifiable runs", async () => {
    const summary = await seedDemoData();
    expect(summary.agents).toBe(2);
    expect(summary.runs).toHaveLength(4);

    // Every seeded run has a real, server-verifiable receipt.
    for (const r of summary.runs) {
      const receipt = await getReceipt(r.runId);
      expect(receipt.runHash).toBe(r.receiptHash);
      const verification = await getRunVerification(r.runId);
      expect(verification.valid).toBe(true);
    }
  });

  it("produces the three required risk scenarios", async () => {
    const byId = async (ext: string) =>
      prisma.run.findFirstOrThrow({
        where: { runExternalId: ext },
        include: { riskFlags: true },
      });

    const clean = await byId("job-2026-0001-clean");
    expect(clean.riskFlags.some((f) => f.flagType === "policy_violation")).toBe(false);

    const violation = await byId("job-2026-0002-policy-violation");
    expect(violation.riskLevel).toBe("HIGH");
    expect(violation.riskFlags.some((f) => f.flagType === "policy_violation")).toBe(true);

    const irreversible = await byId("job-2026-0003-irreversible-no-approval");
    expect(irreversible.riskLevel).toBe("CRITICAL");
    const types = irreversible.riskFlags.map((f) => f.flagType);
    expect(types).toContain("irreversible_action");
    expect(types).toContain("approval_missing");
    expect(types).toContain("policy_violation");
  });

  it("resetDemoData is idempotent — re-seeding yields a fresh single dataset", async () => {
    await resetDemoData();
    await resetDemoData();
    expect(await prisma.owner.count()).toBe(1);
    expect(await prisma.run.count()).toBe(4);
    expect(await isDatabaseEmpty()).toBe(false);
  });
});

describe("POST /v1/demo/reset guard", () => {
  it("returns 404 when DEMO_MODE is not enabled (default in tests)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/demo/reset",
      headers: { authorization: "Bearer dev_key_local" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
