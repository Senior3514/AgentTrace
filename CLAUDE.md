# AgentTrace

## Purpose
AgentTrace is an execution evidence layer for AI agents. It records runtime
events, binds them to policy and approval context, and generates signed
receipts for finalized runs.

## Product boundaries
Do build:
- ingestion API
- provenance/event trail
- receipt engine
- dashboard
- SDK

Do not build in v0:
- chatbot
- agent framework
- blockchain
- public trust marketplace
- billing
- SSO
- ML risk scoring
- advanced policy authoring UI

## Stack
- pnpm monorepo
- Fastify + TypeScript
- PostgreSQL + Prisma
- Next.js + Tailwind
- Docker Compose
- API key auth
- SHA-256 hashing
- Ed25519 signatures

## Repository layout
- `apps/api` - Fastify ingestion API + receipt engine
- `apps/dashboard` - Next.js App Router dashboard
- `packages/shared` - enums, Zod schemas, hashing, Ed25519, risk engine, receipt types
- `packages/sdk-ts` - `@agenttrace/sdk` client + demo
- `prisma` - schema, migrations, seed
- `scripts` - key generation and tooling
- `docs` - architecture, API, receipts

## Design rules
- dark mode first
- security/observability feel
- left aligned
- compact density
- no gradient AI aesthetics
- no decorative fluff
- palette: bg #0A0D10, surface #11161B / #151C22, border #26313B, text #E8F0F7,
  muted #93A4B5, verified #2EE6A6, trace #3BA7FF, warning #F6B84C, critical #FF5C7A

## Core priorities
1. deterministic receipt generation
2. correct event ordering and finalization rules
3. clear API
4. credible dashboard
5. usable SDK

## Invariants (do not break)
- Sequence numbers are unique within a run and appended in order.
- Finalized runs cannot receive new events.
- Finalize fails if sequence continuity is broken.
- Write endpoints require an API key.
- Receipt generation is deterministic: same run → same `runHash`.
- Volatile fields (e.g. `generatedAt`) are excluded from the hashed receipt body.
- Risk flags are deterministic - no randomness, no clock reads, no ML.
- Ed25519 primitives live in `packages/shared` so the SDK can verify without the API.

## Key files
- `packages/shared/src/hashing.ts` - canonicalization + SHA-256 chaining
- `packages/shared/src/risk.ts` - deterministic risk engine
- `apps/api/src/lib/receipt-engine.ts` - receipt build + verify
- `apps/api/src/services/finalize.ts` - finalize transaction
- `apps/api/src/services/events.ts` - append ordering rules

## Conventions
- The API runs under `tsx` (dev and containers) because the workspace consumes
  `@agenttrace/shared` as TypeScript source.
- Validation uses Zod schemas from `@agenttrace/shared`; routes call `parse()`.
- Errors are thrown as `AppError` and mapped to HTTP by the Fastify error handler.

## Working rules
- inspect before changing
- improve incrementally
- do not restart working code
- end each milestone with summary, changed files, test instructions, commit
  message, next step

## Writing style
- Never use the em dash character in any text (docs, README, comments, strings,
  commit messages, PR bodies, chat). Use a regular hyphen instead. The em dash
  reads as non human and is banned in this project's writing.

## Build skills (.claude/skills)
Ten skills encode the repeatable build and improvement workflow. Use them; the
autonomous improvement loop chains them every round.
- `verify-baseline`: sync main, ensure DB, run install + typecheck + tests.
- `db-up`: start and migrate the local Postgres (it gets reaped on idle).
- `improvement-scan`: multi dimension analysis plus adversarial ranking to pick
  the single highest value to risk improvement to ship next.
- `invariant-guard`: confirm the core invariants above still hold.
- `e2e-smoke`: run the full quickstart against the real API and prove verify true.
- `receipt-verify`: verify a receipt offline (hash, signature, version).
- `vercel-doctor`: diagnose and keep the Vercel serverless deploy healthy.
- `security-pass`: review the diff and codebase for security and robustness.
- `ship-pr`: commit, push, open a PR with real evidence, watch CI, squash merge.
- `round-summary`: write the concise end to end report after a round.

Each round: improvement-scan, implement, verify-baseline + invariant-guard,
ship-pr, round-summary. One focused, verified change per round.
