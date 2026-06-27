# @agenttrace/api

Fastify ingestion API and receipt engine for AgentTrace.

## Run

```bash
pnpm dev:api          # from repo root, tsx watch
# or
pnpm --filter @agenttrace/api dev
```

Requires `DATABASE_URL`. See the root `.env.example`.

## Environment

| Var | Default | Notes |
| --- | ------- | ----- |
| `DATABASE_URL` | - | PostgreSQL connection string (required) |
| `API_HOST` | `0.0.0.0` | |
| `API_PORT` | `4000` | |
| `API_KEYS` | `dev_key_local` | comma-separated global/admin keys; per-owner keys are minted via the API |
| `RECEIPT_SIGNING_KEY` | - | Ed25519 seed (hex). Required in production. |
| `RECEIPT_PUBLIC_KEY` | derived | optional; derived from the signing key if omitted |
| `RATE_LIMIT_MAX` | `1000` | max requests per window, per client IP |
| `RATE_LIMIT_WINDOW` | `1 minute` | rate-limit window |

Generate a keypair: `pnpm keys:generate`.

## Layout

```
src/
  app.ts              Fastify app factory (exported for tests)
  index.ts            server entry
  config.ts           env config (+ .env loading)
  db.ts               Prisma client singleton
  crypto/             Ed25519 keystore (primitives live in @agenttrace/shared)
  plugins/api-key.ts  constant-time API key auth
  lib/
    errors.ts         typed AppError + HTTP mapping
    validate.ts       Zod parse helper
    receipt-engine.ts deterministic hash-chain + signed receipt
  routes/
    read.ts           GET endpoints (no auth)
    write.ts          POST endpoints (API key)
  services/           business logic (entities, runs, events, finalize)
```

## Endpoints

Writes require `Authorization: Bearer <key>`.

- `POST /v1/owners` `/v1/agents` `/v1/policies`
- `POST /v1/runs` `/v1/events` `/v1/approvals` `/v1/attestations` `/v1/artifacts`
- `POST /v1/runs/:id/finalize`
- `GET /v1/agents` `/v1/agents/:id` `/v1/agents/:id/runs`
- `GET /v1/runs` `/v1/runs/:id` `/v1/runs/:id/receipt`
- `GET /health`

## Test

```bash
pnpm --filter @agenttrace/api test   # needs DATABASE_URL pointed at a test DB
```
