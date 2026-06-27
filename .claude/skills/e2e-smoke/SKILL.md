---
name: e2e-smoke
description: Prove the AgentTrace product works end to end against the real API and real Postgres. Use after API or receipt changes, or when you need real evidence that a run produces a verifying receipt. Brings up the API, runs the full quickstart (owner, agent, policy, run, events, finalize, receipt, verify) over real HTTP, and asserts verify is true.
---

# e2e-smoke

The real proof, not a unit test: a run becomes a signed receipt that verifies.

## Steps

1. Ensure Postgres is up (`db-up`) and start the API:
   ```bash
   export DATABASE_URL="postgresql://agenttrace@localhost:5432/agenttrace?schema=public"
   (cd apps/api && node --import tsx src/index.ts >/tmp/api.log 2>&1 &)
   until curl -fsS http://localhost:4000/health >/dev/null 2>&1; do sleep 1; done
   ```
2. Run the quickstart over real HTTP. Use a helper that always sends the auth
   header correctly (quote it so "Bearer dev_key_local" is not word split):
   ```bash
   B=http://localhost:4000
   post(){ curl -s -H "content-type: application/json" -H "authorization: Bearer dev_key_local" -d "$2" "$B$1"; }
   id(){ node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))'; }

   OWNER=$(post /v1/owners '{"type":"ORG","name":"Smoke"}' | id)
   AGENT=$(post /v1/agents "{\"externalId\":\"smoke-$RANDOM\",\"name\":\"A\",\"ownerId\":\"$OWNER\"}" | id)
   RUN=$(post /v1/runs "{\"agentId\":\"$AGENT\",\"runExternalId\":\"smoke-run\"}" | id)
   post /v1/events "{\"runId\":\"$RUN\",\"seqNo\":0,\"eventType\":\"run_started\",\"actionClass\":\"CONTROL\",\"actorType\":\"SYSTEM\"}" >/dev/null
   post /v1/events "{\"runId\":\"$RUN\",\"seqNo\":1,\"eventType\":\"run_tests\",\"actionClass\":\"CODE_EXECUTION\",\"toolName\":\"vitest\"}" >/dev/null
   post /v1/runs/$RUN/finalize '{}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("riskLevel",JSON.parse(s).riskLevel))'
   curl -s $B/v1/runs/$RUN/receipt/verify
   ```
3. Also exercise the SDK path:
   ```bash
   AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local pnpm --filter @agenttrace/sdk demo
   ```
4. Stop the API: `fuser -k 4000/tcp`.

## Success criteria

`/v1/runs/<id>/receipt/verify` returns `"hashValid":true,"signatureValid":true,"valid":true`,
and the SDK demo prints `Receipt verification: { ... valid: true }`.
