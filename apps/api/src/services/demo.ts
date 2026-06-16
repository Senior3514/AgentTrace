// Demo data: a small, realistic set of agent runs that exercises the evidence
// layer end-to-end. Used by `pnpm seed`, by DEMO_MODE auto-seed on boot, and by
// the guarded POST /v1/demo/reset endpoint.
//
// IMPORTANT: resetDemoData() is destructive. It is only ever called behind a
// DEMO_MODE guard (see config.demoMode) so it can never wipe a real database.

import { prisma } from "../db.js";
import { sha256Hex } from "@agenttrace/shared";
import { createAttestation, createPolicy } from "./entities.js";
import { finalizeRun } from "./finalize.js";

type SeedEvent = {
  eventType: string;
  actionClass: string;
  actorType?: "AGENT" | "SYSTEM" | "HUMAN" | "TOOL";
  toolName?: string;
  targetSystem?: string;
  mutatesState?: boolean;
  irreversible?: boolean;
  /** When set, an APPROVED approval is recorded against this event. */
  approve?: { approverId: string; reason: string };
};

export interface SeededRun {
  runExternalId: string;
  scenario: string;
  runId: string;
  riskLevel: string;
  riskFlags: number;
  receiptHash: string;
}

export interface SeedSummary {
  ownerId: string;
  agents: number;
  runs: SeededRun[];
}

async function deleteAll(): Promise<void> {
  // Order matters: children before parents (FKs).
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

/** True when there is no AgentTrace data at all. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const owners = await prisma.owner.count();
  return owners === 0;
}

/** Build one run from a list of events, then finalize it into a signed receipt. */
async function buildRun(args: {
  agentId: string;
  policyId: string;
  runExternalId: string;
  scenario: string;
  startedMinutesAgo: number;
  events: SeedEvent[];
}): Promise<SeededRun> {
  const startedAt = new Date(Date.now() - args.startedMinutesAgo * 60_000);
  const base = startedAt.getTime();
  const at = (seq: number) => new Date(base + seq * 30_000);

  const run = await prisma.run.create({
    data: {
      agentId: args.agentId,
      runExternalId: args.runExternalId,
      policyId: args.policyId,
      startedAt,
      status: "RUNNING",
    },
  });

  let seqNo = 0;
  for (const ev of args.events) {
    const created = await prisma.event.create({
      data: {
        runId: run.id,
        seqNo,
        eventType: ev.eventType,
        timestamp: at(seqNo),
        actorType: (ev.actorType ?? "AGENT") as never,
        actorId: `agent:${args.runExternalId}`,
        toolName: ev.toolName ?? null,
        targetSystem: ev.targetSystem ?? null,
        actionClass: ev.actionClass as never,
        mutatesState: ev.mutatesState ?? false,
        irreversible: ev.irreversible ?? false,
        metadataJson: {},
      },
    });
    if (ev.approve) {
      await prisma.approval.create({
        data: {
          runId: run.id,
          eventId: created.id,
          approverType: "HUMAN",
          approverId: ev.approve.approverId,
          decision: "APPROVED",
          reason: ev.approve.reason,
          approvedAt: at(seqNo),
        },
      });
    }
    seqNo += 1;
  }

  const { receipt, riskLevel } = await finalizeRun(run.id, {
    status: "FINALIZED",
    endedAt: at(seqNo),
  });
  const riskFlags = await prisma.riskFlag.count({ where: { runId: run.id } });

  return {
    runExternalId: args.runExternalId,
    scenario: args.scenario,
    runId: run.id,
    riskLevel,
    riskFlags,
    receiptHash: receipt.runHash,
  };
}

/**
 * Create the full demo dataset: 1 owner, 2 agents, a bound policy, and 4 runs
 * spanning a clean happy path, a policy violation, an unapproved irreversible
 * action, and an approved-but-high-risk coding flow. Every run is finalized
 * with a verifiable receipt.
 */
export async function seedDemoData(): Promise<SeedSummary> {
  const owner = await prisma.owner.create({
    data: { type: "ORG", name: "Acme Robotics", externalRef: "acme" },
  });

  const codingAgent = await prisma.agent.create({
    data: {
      externalId: "coding-agent-01",
      name: "Coding Agent",
      ownerId: owner.id,
      environment: "production",
      framework: "claude-code",
      metadataJson: { model: "claude-opus", repo: "acme/payments" },
    },
  });

  const dataAgent = await prisma.agent.create({
    data: {
      externalId: "data-agent-02",
      name: "Data Ops Agent",
      ownerId: owner.id,
      environment: "production",
      framework: "langgraph",
      metadataJson: { model: "claude-sonnet", warehouse: "acme-analytics" },
    },
  });

  const policy = await createPolicy({
    ownerId: owner.id,
    name: "Default Agent Policy",
    version: "1",
    policyText:
      "External writes require a human approval. Irreversible actions require a " +
      "human approval. Secret access must be logged. Code execution is permitted " +
      "in CI sandboxes.",
    rules: {
      denyActionClasses: [],
      requireApprovalFor: ["EXTERNAL_CALL"],
      forbidIrreversibleWithoutApproval: true,
    },
  });

  const runs: SeededRun[] = [];

  // (1) Clean happy path — read + sandboxed test, no external write/secret.
  runs.push(
    await buildRun({
      agentId: codingAgent.id,
      policyId: policy.id,
      runExternalId: "job-2026-0001-clean",
      scenario: "clean happy path",
      startedMinutesAgo: 60,
      events: [
        { eventType: "run_started", actionClass: "CONTROL", actorType: "SYSTEM" },
        { eventType: "clone_repo", actionClass: "READ", toolName: "git", targetSystem: "github" },
        { eventType: "read_config", actionClass: "READ", toolName: "fs", targetSystem: "workspace" },
        { eventType: "run_tests", actionClass: "CODE_EXECUTION", toolName: "vitest", targetSystem: "ci-sandbox" },
        { eventType: "run_completed", actionClass: "CONTROL", actorType: "SYSTEM" },
      ],
    }),
  );

  // (2) Policy violation — unapproved EXTERNAL_CALL + secret access.
  runs.push(
    await buildRun({
      agentId: codingAgent.id,
      policyId: policy.id,
      runExternalId: "job-2026-0002-policy-violation",
      scenario: "policy violation + risk flags",
      startedMinutesAgo: 45,
      events: [
        { eventType: "run_started", actionClass: "CONTROL", actorType: "SYSTEM" },
        { eventType: "read_deploy_secret", actionClass: "SECRET_ACCESS", toolName: "vault", targetSystem: "vault-internal" },
        // External write with NO approval → violates requireApprovalFor.
        { eventType: "push_branch", actionClass: "EXTERNAL_CALL", toolName: "github_api", targetSystem: "github", mutatesState: true },
        { eventType: "run_completed", actionClass: "CONTROL", actorType: "SYSTEM" },
      ],
    }),
  );

  // (3) Irreversible action missing approval.
  runs.push(
    await buildRun({
      agentId: dataAgent.id,
      policyId: policy.id,
      runExternalId: "job-2026-0003-irreversible-no-approval",
      scenario: "irreversible action missing approval",
      startedMinutesAgo: 30,
      events: [
        { eventType: "run_started", actionClass: "CONTROL", actorType: "SYSTEM" },
        { eventType: "query_warehouse", actionClass: "READ", toolName: "sql", targetSystem: "acme-analytics" },
        // Irreversible, mutating, unapproved → violates forbidIrreversibleWithoutApproval.
        { eventType: "drop_stale_partition", actionClass: "WRITE", toolName: "sql", targetSystem: "acme-analytics", mutatesState: true, irreversible: true },
        { eventType: "run_completed", actionClass: "CONTROL", actorType: "SYSTEM" },
      ],
    }),
  );

  // (4) Approved-but-high-risk coding flow (open PR → tests → secret → approve → merge).
  const rich = await buildRun({
    agentId: codingAgent.id,
    policyId: policy.id,
    runExternalId: "job-2026-0004-approved-merge",
    scenario: "approved high-risk merge",
    startedMinutesAgo: 12,
    events: [
      { eventType: "run_started", actionClass: "CONTROL", actorType: "SYSTEM" },
      { eventType: "clone_repo", actionClass: "READ", toolName: "git", targetSystem: "github" },
      { eventType: "open_pr", actionClass: "EXTERNAL_CALL", toolName: "github_api", targetSystem: "github", mutatesState: true, approve: { approverId: "alice@acme.dev", reason: "Opening PR approved." } },
      { eventType: "run_tests", actionClass: "CODE_EXECUTION", toolName: "vitest", targetSystem: "ci-sandbox" },
      { eventType: "read_deploy_secret", actionClass: "SECRET_ACCESS", toolName: "vault", targetSystem: "vault-internal" },
      { eventType: "merge_pr", actionClass: "EXTERNAL_CALL", toolName: "github_api", targetSystem: "github", mutatesState: true, irreversible: true, approve: { approverId: "alice@acme.dev", reason: "Reviewed diff and CI; safe to merge." } },
      { eventType: "run_completed", actionClass: "CONTROL", actorType: "SYSTEM" },
    ],
  });
  runs.push(rich);

  // Attach an artifact + signed attestation to the rich run for the dashboard.
  await prisma.artifact.create({
    data: {
      runId: rich.runId,
      artifactType: "DIFF",
      uri: "github://acme/payments/pull/482.diff",
      sha256: sha256Hex("diff --git a/pay.ts b/pay.ts\n+ retry logic"),
      contentPreview: "diff --git a/pay.ts b/pay.ts\n@@ retry logic for failed charges @@",
    },
  });
  await createAttestation({
    runId: rich.runId,
    attestationType: "POLICY_BINDING",
    subject: "policy-compliance",
    statement: "Run executed under Default Agent Policy v1 with recorded approvals.",
    evidenceRef: policy.policyHash,
  });

  return { ownerId: owner.id, agents: 2, runs };
}

/** Destructive: wipe all data and re-seed. Guard with DEMO_MODE before calling. */
export async function resetDemoData(): Promise<SeedSummary> {
  await deleteAll();
  return seedDemoData();
}

/** Seed only if the database is empty. Used by DEMO_MODE auto-seed on boot. */
export async function autoSeedIfEmpty(): Promise<SeedSummary | null> {
  if (!(await isDatabaseEmpty())) return null;
  return seedDemoData();
}
