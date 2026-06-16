# AgentTrace

**An execution evidence layer for AI agents.**

AgentTrace records the runtime events of an AI agent, binds each action to its
policy and approval context, applies deterministic risk flags, and seals
finalized runs into **signed, independently verifiable receipts**.

> Trust comes from evidence, not claims. Important actions must be traceable.
> Finalized runs must produce verifiable receipts.

A receipt proves the **integrity and authenticity of the event trail the agent
reported** — not that the trail is **complete**. Read the
[**threat model**](docs/threat-model.md) for the precise scope before relying on
it; it is the authoritative statement of what a receipt does and does not prove.

---

## What's in the box

| Piece | Path | Description |
| ----- | ---- | ----------- |
| Ingestion API | `apps/api` | Fastify + Prisma. Owners, agents, policies, runs, events, approvals, attestations, finalize + receipt endpoints. |
| Receipt engine | `apps/api/src/lib/receipt-engine.ts` | Deterministic SHA-256 event hash-chaining + Ed25519 signed receipts. |
| Dashboard | `apps/dashboard` | Next.js App Router. Agents, runs, event timeline, signed-receipt viewer with on-page verification. |
| Shared package | `packages/shared` | Enums, Zod schemas, canonical hashing, Ed25519, deterministic risk engine, receipt types. |
| TypeScript SDK | `packages/sdk-ts` | `@agenttrace/sdk` typed client + local receipt verification + coding-agent demo. |
| Schema + seed | `prisma` | PostgreSQL schema, migrations, realistic seed run. |

## Architecture

```
   agent / SDK ──POST events──▶  Ingestion API  ──▶  PostgreSQL (Prisma)
                                      │
                              finalize │ (deterministic)
                                      ▼
                       Risk engine ──▶ Receipt engine
                                      │  SHA-256 chain + Ed25519 sign
                                      ▼
                              Signed receipt (verifiable anywhere)
                                      ▲
                         Dashboard ───┘  reads + verifies
```

See [`docs/architecture.md`](docs/architecture.md) and
[`docs/receipts.md`](docs/receipts.md) for details.

## Quickstart (local, no Docker)

```bash
# 1. Install
pnpm install

# 2. Start PostgreSQL however you like, then point Prisma at it:
cp .env.example .env
# edit DATABASE_URL in .env

# 3. (optional) stable signing key for verifiable receipts across restarts
pnpm keys:generate           # paste output into .env

# 4. Apply schema + load a sample run
pnpm prisma:deploy
pnpm seed

# 5. Run it
pnpm dev:api                 # http://localhost:4000
pnpm dev:dashboard           # http://localhost:3000
```

## Quickstart (Docker Compose)

```bash
docker compose up --build
# API:        http://localhost:4000
# Dashboard:  http://localhost:3000
```

The API container applies migrations on boot. Seed four realistic runs with:

```bash
docker compose exec api pnpm seed
```

New here? Follow [`docs/quickstart.md`](docs/quickstart.md) — clone → seed →
create a run → finalize → **a receipt that verifies** (`curl` and SDK).

## Deploy (Vercel)

The API (serverless) and dashboard deploy as two Vercel projects from this
monorepo. See [`docs/deploy-vercel.md`](docs/deploy-vercel.md) for project
settings, environment variables, and the hosted-Postgres requirement.

## Desktop app

A native desktop shell (Electron) around the dashboard lives in
[`apps/desktop`](apps/desktop/README.md). Point it at a local or deployed
dashboard and launch with `pnpm --filter @agenttrace/desktop start`.

## Try the SDK

```bash
AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local \
  pnpm --filter @agenttrace/sdk demo
```

## Verify a receipt offline

No server, database, or private key required — just the receipt JSON:

```bash
curl -s http://localhost:4000/v1/runs/<id>/receipt > receipt.json
pnpm verify:receipt receipt.json     # exit 0 = valid, 1 = invalid
# or pipe it:  curl -s .../receipt | pnpm verify:receipt -
```

## Test

```bash
# Requires a (test) database in DATABASE_URL
pnpm test
```

Covers: agent creation, run start, ordered event append, out-of-order
rejection, append-after-finalization rejection, the finalize flow, signature
verification, and deterministic hashing.

## API surface

Writes require an API key (`Authorization: Bearer <key>` or `x-api-key`).

| Method | Path | Auth |
| ------ | ---- | ---- |
| POST | `/v1/owners` `/v1/agents` `/v1/policies` | ✅ |
| POST | `/v1/runs` `/v1/events` `/v1/approvals` `/v1/attestations` `/v1/artifacts` | ✅ |
| POST | `/v1/runs/:id/finalize` | ✅ |
| GET | `/v1/agents` `/v1/agents/:id` `/v1/agents/:id/runs` | — |
| GET | `/v1/runs` `/v1/runs/:id` `/v1/runs/:id/receipt` | — |

Full reference: [`docs/api.md`](docs/api.md).

## Docs

- [`docs/architecture.md`](docs/architecture.md) — components, data model, lifecycle
- [`docs/receipts.md`](docs/receipts.md) — determinism, signing, verification
- [`docs/api.md`](docs/api.md) — endpoint reference
- [`docs/security-checklist.md`](docs/security-checklist.md) — security baseline for agent integrations

## v0 boundaries

**In:** ingestion API, provenance/event trail, receipt engine, deterministic
risk flags, dashboard, TypeScript SDK, Docker Compose, docs.

**Out (by design):** chatbot, agent framework, blockchain, billing, SSO, public
trust marketplace, ML-based anomaly scoring, advanced policy authoring.

## License

MIT
