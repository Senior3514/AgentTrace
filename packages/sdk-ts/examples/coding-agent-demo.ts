/**
 * End-to-end demo: a coding agent that opens a PR, runs tests, requests an
 * approval, merges, and finalizes a signed receipt.
 *
 * Prerequisites:
 *   - API running (pnpm dev:api) with a known API key
 *   - DATABASE migrated (pnpm prisma:deploy)
 *
 * Run with:
 *   AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local \
 *     pnpm --filter @agenttrace/sdk demo
 */
import { AgentTraceClient } from "../src/index.js";

const baseUrl = process.env.AGENTTRACE_API_URL ?? "http://localhost:4000";
const apiKey = process.env.AGENTTRACE_API_KEY ?? "dev_key_local";

async function main(): Promise<void> {
  const at = new AgentTraceClient({ baseUrl, apiKey });

  const owner = await at.createOwner({ name: "Demo Org", type: "ORG" });
  const agent = await at.createAgent({
    externalId: `demo-agent-${Date.now()}`,
    name: "Demo Coding Agent",
    ownerId: owner.id,
    framework: "claude-code",
  });
  const policy = await at.createPolicy({
    ownerId: owner.id,
    name: "Demo Policy",
    policyText: "External writes and irreversible actions require approval.",
  });

  const run = await at.startRun({
    agentId: agent.id,
    runExternalId: `demo-run-${Date.now()}`,
    policyId: policy.id,
  });
  console.log(`Started run ${run.id}`);

  let seqNo = 0;
  const step = (args: Record<string, unknown>) =>
    at.reportEvent({ runId: run.id, seqNo: seqNo++, ...(args as { eventType: string }) });

  await step({ eventType: "open_pr", actionClass: "EXTERNAL_CALL", toolName: "github_api", targetSystem: "github", mutatesState: true });
  await step({ eventType: "run_tests", actionClass: "CODE_EXECUTION", toolName: "vitest", targetSystem: "ci-sandbox" });
  await step({ eventType: "request_approval", actionClass: "APPROVAL" });
  const merge = (await step({
    eventType: "merge_pr",
    actionClass: "EXTERNAL_CALL",
    toolName: "github_api",
    targetSystem: "github",
    mutatesState: true,
    irreversible: true,
  })) as { id: string };

  await at.reportApproval({
    runId: run.id,
    eventId: merge.id,
    approverId: "reviewer@demo.dev",
    decision: "APPROVED",
    reason: "CI green, diff reviewed.",
  });

  const { receipt, riskLevel } = await at.finalizeRun(run.id);
  console.log(`Finalized run with risk level: ${riskLevel}`);
  console.log(`Receipt hash: ${receipt.runHash}`);

  const verification = at.verifyReceipt(receipt);
  console.log(`Receipt verification:`, verification);
  if (!verification.valid) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
