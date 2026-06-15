import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyReceipt } from "@agenttrace/shared";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db.js";

const AUTH = { authorization: "Bearer dev_key_local" };

let app: FastifyInstance;

async function resetDb(): Promise<void> {
  // Children first to respect FK constraints.
  await prisma.riskFlag.deleteMany();
  await prisma.attestation.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.event.deleteMany();
  await prisma.run.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.owner.deleteMany();
}

async function seedOwnerAgent() {
  const owner = await app
    .inject({ method: "POST", url: "/v1/owners", headers: AUTH, payload: { name: "Acme", type: "ORG" } })
    .then((r) => r.json());
  const agent = await app
    .inject({
      method: "POST",
      url: "/v1/agents",
      headers: AUTH,
      payload: { externalId: `agent-${Date.now()}`, name: "Coder", ownerId: owner.id },
    })
    .then((r) => r.json());
  return { owner, agent };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("auth", () => {
  it("rejects writes without an API key", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/owners", payload: { name: "x" } });
    expect(res.statusCode).toBe(401);
  });
});

describe("agents", () => {
  it("creates an agent", async () => {
    const { agent } = await seedOwnerAgent();
    expect(agent.id).toBeTruthy();
    expect(agent.name).toBe("Coder");

    const list = await app.inject({ method: "GET", url: "/v1/agents" }).then((r) => r.json());
    expect(list.total).toBe(1);
  });
});

describe("runs and events", () => {
  it("starts a run", async () => {
    const { agent } = await seedOwnerAgent();
    const res = await app.inject({
      method: "POST",
      url: "/v1/runs",
      headers: AUTH,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe("RUNNING");
  });

  it("appends events in order", async () => {
    const { agent } = await seedOwnerAgent();
    const run = await app
      .inject({ method: "POST", url: "/v1/runs", headers: AUTH, payload: { agentId: agent.id } })
      .then((r) => r.json());

    for (let seqNo = 0; seqNo < 3; seqNo++) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: AUTH,
        payload: { runId: run.id, seqNo, eventType: `step-${seqNo}` },
      });
      expect(res.statusCode).toBe(201);
    }
  });

  it("rejects out-of-order events", async () => {
    const { agent } = await seedOwnerAgent();
    const run = await app
      .inject({ method: "POST", url: "/v1/runs", headers: AUTH, payload: { agentId: agent.id } })
      .then((r) => r.json());

    await app.inject({
      method: "POST",
      url: "/v1/events",
      headers: AUTH,
      payload: { runId: run.id, seqNo: 0, eventType: "a" },
    });
    // Skipping seqNo 1.
    const res = await app.inject({
      method: "POST",
      url: "/v1/events",
      headers: AUTH,
      payload: { runId: run.id, seqNo: 2, eventType: "c" },
    });
    expect(res.statusCode).toBe(422);
  });
});

describe("finalization", () => {
  async function buildRunWithEvents() {
    const { agent } = await seedOwnerAgent();
    const run = await app
      .inject({ method: "POST", url: "/v1/runs", headers: AUTH, payload: { agentId: agent.id } })
      .then((r) => r.json());

    const events = [
      { eventType: "open_pr", actionClass: "EXTERNAL_CALL", mutatesState: true, targetSystem: "github" },
      { eventType: "run_tests", actionClass: "CODE_EXECUTION", toolName: "vitest" },
      { eventType: "merge_pr", actionClass: "EXTERNAL_CALL", mutatesState: true, irreversible: true, targetSystem: "github" },
    ];
    let seqNo = 0;
    let mergeEventId: string | undefined;
    for (const ev of events) {
      const created = await app
        .inject({ method: "POST", url: "/v1/events", headers: AUTH, payload: { runId: run.id, seqNo, ...ev } })
        .then((r) => r.json());
      if (ev.eventType === "merge_pr") mergeEventId = created.id;
      seqNo++;
    }
    return { run, mergeEventId };
  }

  it("finalizes a run and returns a verifiable receipt", async () => {
    const { run, mergeEventId } = await buildRunWithEvents();
    await app.inject({
      method: "POST",
      url: "/v1/approvals",
      headers: AUTH,
      payload: { runId: run.id, eventId: mergeEventId, approverId: "alice", decision: "APPROVED" },
    });

    const finalizeRes = await app.inject({
      method: "POST",
      url: `/v1/runs/${run.id}/finalize`,
      headers: AUTH,
      payload: {},
    });
    expect(finalizeRes.statusCode).toBe(200);
    const { receipt } = finalizeRes.json();
    expect(receipt.runHash).toMatch(/^[0-9a-f]{64}$/);

    const verification = verifyReceipt(receipt);
    expect(verification.hashValid).toBe(true);
    expect(verification.signatureValid).toBe(true);
    expect(verification.valid).toBe(true);
  });

  it("rejects appends after finalization", async () => {
    const { run } = await buildRunWithEvents();
    await app.inject({ method: "POST", url: `/v1/runs/${run.id}/finalize`, headers: AUTH, payload: {} });

    const res = await app.inject({
      method: "POST",
      url: "/v1/events",
      headers: AUTH,
      payload: { runId: run.id, seqNo: 3, eventType: "late" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("verifies a finalized run and detects post-finalization tampering", async () => {
    const { run } = await buildRunWithEvents();
    await app.inject({ method: "POST", url: `/v1/runs/${run.id}/finalize`, headers: AUTH, payload: {} });

    // Clean verification passes.
    const clean = await app
      .inject({ method: "GET", url: `/v1/runs/${run.id}/receipt/verify` })
      .then((r) => r.json());
    expect(clean.valid).toBe(true);
    expect(clean.hashValid).toBe(true);
    expect(clean.signatureValid).toBe(true);
    expect(clean.recomputedHash).toBe(clean.sealedHash);

    // Tamper with a sealed event directly in the database.
    await prisma.event.updateMany({
      where: { runId: run.id, eventType: "open_pr" },
      data: { targetSystem: "evil-host" },
    });

    const tampered = await app
      .inject({ method: "GET", url: `/v1/runs/${run.id}/receipt/verify` })
      .then((r) => r.json());
    expect(tampered.hashValid).toBe(false); // recomputed hash no longer matches the seal
    expect(tampered.valid).toBe(false);
    expect(tampered.recomputedHash).not.toBe(tampered.sealedHash);
  });

  it("serves a stable receipt from the receipt endpoint", async () => {
    const { run } = await buildRunWithEvents();
    const finalize = await app
      .inject({ method: "POST", url: `/v1/runs/${run.id}/finalize`, headers: AUTH, payload: {} })
      .then((r) => r.json());

    const receipt = await app
      .inject({ method: "GET", url: `/v1/runs/${run.id}/receipt` })
      .then((r) => r.json());

    expect(receipt.runHash).toBe(finalize.receipt.runHash);
    expect(verifyReceipt(receipt).valid).toBe(true);
    // Risk flags were computed deterministically (external write + irreversible).
    expect(receipt.body.riskFlags.length).toBeGreaterThan(0);
  });
});
