# AgentTrace

**An execution evidence layer for AI agents.**

AgentTrace records the runtime events of an AI agent, binds each action to its
policy and approval context, applies deterministic risk flags, and seals
finalized runs into **signed, independently verifiable receipts**.

> Trust comes from evidence, not claims. Important actions must be traceable.
> Finalized runs must produce verifiable receipts.

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

The API container applies migrations on boot. Seed it with:

```bash
docker compose exec api pnpm seed
```

## Try the SDK

```bash
AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local \
  pnpm --filter @agenttrace/sdk demo
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
