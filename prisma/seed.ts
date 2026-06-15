// Seed a realistic coding-agent run and finalize it into a signed receipt.
// Run with: pnpm seed
import { prisma } from "../apps/api/src/db.js";
import { createPolicy } from "../apps/api/src/services/entities.js";
import { finalizeRun } from "../apps/api/src/services/finalize.js";

async function clear(): Promise<void> {
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

async function main(): Promise<void> {
  console.log("Seeding AgentTrace…");
  await clear();

  const owner = await prisma.owner.create({
    data: { type: "ORG", name: "Acme Robotics", externalRef: "acme" },
  });

  const agent = await prisma.agent.create({
    data: {
      externalId: "coding-agent-01",
      name: "Coding Agent",
      ownerId: owner.id,
      environment: "production",
      framework: "claude-code",
      metadataJson: { model: "claude-opus", repo: "acme/payments" },
    },
  });

  const policy = await createPolicy({
    ownerId: owner.id,
    name: "Coding Agent Default Policy",
    version: "1",
    policyText:
      "External writes and irreversible actions require a human approval. " +
      "Secret access must be logged. Code execution is permitted in CI sandboxes.",
  });

  const startedAt = new Date(Date.now() - 1000 * 60 * 12);
  const run = await prisma.run.create({
    data: {
      agentId: agent.id,
      runExternalId: "job-2026-0001",
      policyId: policy.id,
      startedAt,
      status: "RUNNING",
    },
  });

  const base = startedAt.getTime();
  const t = (offsetSeconds: number) => new Date(base + offsetSeconds * 1000);

  // A realistic coding-agent flow: open PR → run tests → access secret →
  // request approval → merge PR.
  const events = [
    { eventType: "run_started", actionClass: "CONTROL", actorType: "SYSTEM" },
    { eventType: "clone_repo", actionClass: "READ", toolName: "git", targetSystem: "github" },
    {
      eventType: "open_pr",
      actionClass: "EXTERNAL_CALL",
      toolName: "github_api",
      targetSystem: "github",
      mutatesState: true,
    },
    { eventType: "run_tests", actionClass: "CODE_EXECUTION", toolName: "vitest", targetSystem: "ci-sandbox" },
    { eventType: "read_deploy_secret", actionClass: "SECRET_ACCESS", toolName: "vault", targetSystem: "vault-internal" },
    { eventType: "request_approval", actionClass: "APPROVAL", actorType: "AGENT" },
    {
      eventType: "merge_pr",
      actionClass: "EXTERNAL_CALL",
      toolName: "github_api",
      targetSystem: "github",
      mutatesState: true,
      irreversible: true,
    },
    { eventType: "run_completed", actionClass: "CONTROL", actorType: "SYSTEM" },
  ] as const;

  let mergeEventId = "";
  let seqNo = 0;
  for (const ev of events) {
    const created = await prisma.event.create({
      data: {
        runId: run.id,
        seqNo,
        eventType: ev.eventType,
        timestamp: t(seqNo * 30),
        actorType: ("actorType" in ev ? ev.actorType : "AGENT") as never,
        actorId: "agent:coding-agent-01",
        toolName: "toolName" in ev ? ev.toolName : null,
        targetSystem: "targetSystem" in ev ? ev.targetSystem : null,
        actionClass: ev.actionClass as never,
        mutatesState: "mutatesState" in ev ? ev.mutatesState : false,
        irreversible: "irreversible" in ev ? ev.irreversible : false,
        metadataJson: {},
      },
    });
    if (ev.eventType === "merge_pr") mergeEventId = created.id;
    seqNo++;
  }

  await prisma.approval.create({
    data: {
      runId: run.id,
      eventId: mergeEventId,
      approverType: "HUMAN",
      approverId: "alice@acme.dev",
      decision: "APPROVED",
      reason: "Reviewed diff and CI results; safe to merge.",
      approvedAt: t(195),
    },
  });

  const { receipt, riskLevel } = await finalizeRun(run.id, {
    status: "FINALIZED",
    endedAt: t(240),
  });

  const flags = await prisma.riskFlag.count({ where: { runId: run.id } });

  console.log("Seed complete:");
  console.log(`  owner:      ${owner.name} (${owner.id})`);
  console.log(`  agent:      ${agent.name} (${agent.id})`);
  console.log(`  policy:     ${policy.name} v${policy.version}`);
  console.log(`  run:        ${run.id} → ${riskLevel}`);
  console.log(`  events:     ${events.length}`);
  console.log(`  risk flags: ${flags}`);
  console.log(`  receipt:    ${receipt.runHash}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
