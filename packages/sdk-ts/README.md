# @agenttrace/sdk

Typed TypeScript client for the AgentTrace API, plus local receipt verification.

## Install (in this monorepo)

Already wired as a workspace package. In an external project you would publish
and `pnpm add @agenttrace/sdk`.

## Usage

```ts
import { AgentTraceClient } from "@agenttrace/sdk";

const at = new AgentTraceClient({
  baseUrl: "http://localhost:4000",
  apiKey: process.env.AGENTTRACE_API_KEY!,
});

const owner = await at.createOwner({ name: "Acme", type: "ORG" });
const agent = await at.createAgent({
  externalId: "coding-agent-01",
  name: "Coding Agent",
  ownerId: owner.id,
});
const policy = await at.createPolicy({
  ownerId: owner.id,
  name: "Default",
  policyText: "External writes require approval.",
});

const run = await at.startRun({ agentId: agent.id, policyId: policy.id });

await at.reportEvent({
  runId: run.id,
  seqNo: 0,
  eventType: "merge_pr",
  actionClass: "EXTERNAL_CALL",
  mutatesState: true,
  irreversible: true,
});
await at.reportApproval({ runId: run.id, approverId: "alice", decision: "APPROVED" });

const { receipt } = await at.finalizeRun(run.id);
console.log(at.verifyReceipt(receipt)); // { hashValid, signatureValid, valid }
```

## Methods

`createOwner` · `createAgent` · `createPolicy` · `startRun` · `reportEvent` ·
`reportApproval` · `reportAttestation` · `finalizeRun` · `getRun` · `getReceipt` ·
`listRuns` · `listAgents` · `verifyReceipt`

## Verification

`verifyReceipt(receipt)` recomputes the canonical run hash from the receipt body
and checks the Ed25519 signature against the public key embedded in the receipt.
No server, private key, or database required.

## Demo

```bash
AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local \
  pnpm --filter @agenttrace/sdk demo
```

Runs a realistic coding-agent flow: open PR → run tests → request approval →
merge PR → finalize receipt.
