# Quickstart - from clone to a verified receipt

This is the copy-paste path from a fresh clone to a **signed receipt that
verifies**. Two ways: raw `curl`, and the TypeScript SDK. Both hit the real
Fastify API backed by real PostgreSQL.

## 0. Bring it up

```bash
git clone <repo> && cd AgentTrace
cp .env.example .env

# Real Postgres + API + dashboard:
docker compose up --build
# API:        http://localhost:4000
# Dashboard:  http://localhost:3000
```

The API container applies migrations on boot. Seed four realistic runs:

```bash
docker compose exec api pnpm seed
```

`pnpm seed` creates **1 owner, 2 agents, and 4 finalized runs** - a clean happy
path, a policy violation, an unapproved irreversible action, and an approved
high-risk merge - each with a verifiable receipt. The dashboard is then
non-empty out of the box.

> **DEMO_MODE**: set `DEMO_MODE=true` and the API auto-seeds an empty database
> on boot, and exposes `POST /v1/demo/reset` (guarded - it refuses to run unless
> `DEMO_MODE=true`, so it can never wipe a real database).

## 1. Create a verified receipt with `curl`

Writes require an API key (`dev_key_local` by default). Real captured output is
shown after each step.

```bash
B=http://localhost:4000
auth=(-H "content-type: application/json" -H "authorization: Bearer dev_key_local")

curl -s -o /dev/null -w "health: HTTP %{http_code}\n" $B/health
# health: HTTP 200

OWNER=$(curl -s "${auth[@]}" -d '{"type":"ORG","name":"Demo Co"}' $B/v1/owners | jq -r .id)
AGENT=$(curl -s "${auth[@]}" -d "{\"externalId\":\"qs-agent\",\"name\":\"QS Agent\",\"ownerId\":\"$OWNER\"}" $B/v1/agents | jq -r .id)
POLICY=$(curl -s "${auth[@]}" -d "{\"ownerId\":\"$OWNER\",\"name\":\"QS Policy\",\"policyText\":\"approvals required\",\"rules\":{\"requireApprovalFor\":[\"EXTERNAL_CALL\"]}}" $B/v1/policies | jq -r .id)
RUN=$(curl -s "${auth[@]}" -d "{\"agentId\":\"$AGENT\",\"policyId\":\"$POLICY\",\"runExternalId\":\"qs-run-1\"}" $B/v1/runs | jq -r .id)

# Append the event trail (sequence numbers must be contiguous and in order):
curl -s "${auth[@]}" -d "{\"runId\":\"$RUN\",\"seqNo\":0,\"eventType\":\"run_started\",\"actionClass\":\"CONTROL\",\"actorType\":\"SYSTEM\"}" $B/v1/events
curl -s "${auth[@]}" -d "{\"runId\":\"$RUN\",\"seqNo\":1,\"eventType\":\"read_repo\",\"actionClass\":\"READ\",\"toolName\":\"git\"}" $B/v1/events
curl -s "${auth[@]}" -d "{\"runId\":\"$RUN\",\"seqNo\":2,\"eventType\":\"run_tests\",\"actionClass\":\"CODE_EXECUTION\",\"toolName\":\"vitest\"}" $B/v1/events

# Finalize → deterministic risk + signed receipt:
curl -s "${auth[@]}" -d '{}' $B/v1/runs/$RUN/finalize | jq '{riskLevel, runHash: .receipt.runHash}'
# { "riskLevel": "MEDIUM",
#   "runHash": "db8592d9e76875dcba7d2f42076a42aa6352063e0dc3379c7d8168e2b6cd07ec" }

# Fetch the receipt and verify it server-side:
curl -s -o /dev/null -w "receipt: HTTP %{http_code}\n" $B/v1/runs/$RUN/receipt
# receipt: HTTP 200

curl -s $B/v1/runs/$RUN/receipt/verify | jq
# {
#   "runId": "cmqgy88nv00068kdbbyeztdud",
#   "sealedHash":     "db8592d9e76875dcba7d2f42076a42aa6352063e0dc3379c7d8168e2b6cd07ec",
#   "recomputedHash": "db8592d9e76875dcba7d2f42076a42aa6352063e0dc3379c7d8168e2b6cd07ec",
#   "hashValid": true,
#   "signatureValid": true,
#   "valid": true        <-- the receipt verifies
# }
```

`verify` recomputes the run hash from the *current* persisted events and compares
it to the hash sealed at finalize time, then checks the Ed25519 signature. If any
event were mutated after finalization, `hashValid` would be `false`.

## 2. The same flow with the SDK

```bash
AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local \
  pnpm --filter @agenttrace/sdk demo
```

Real captured output:

```
Started run cmqgy8lwh000l8kdb4t4lmg3s
Finalized run with risk level: HIGH
Receipt hash: d85227735a7e5a13c5f8b0f8ec1dd73b9301acdaeabf13f02ea25c8a5c8efb8d
Receipt verification: { hashValid: true, signatureValid: true, valid: true }
```

The SDK verifies the receipt locally using the Ed25519 primitives in
`@agenttrace/shared` - **without calling the API** - so a receipt holder can
verify offline. There is also an offline CLI: `pnpm verify:receipt <file>`.

## What you just proved

The receipt is a signed, hash-chained statement of the event trail the agent
reported. For exactly what that does and does **not** prove, read the
[threat model](threat-model.md).
```
