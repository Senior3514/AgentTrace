# Architecture

AgentTrace is a thin, opinionated evidence layer. It does not run agents - it
records what they did and makes that record verifiable.

## Components

```
┌────────────┐   events/approvals   ┌──────────────┐
│ agent /SDK │ ───────────────────▶ │ Ingestion API│
└────────────┘                      │  (Fastify)   │
                                    └──────┬───────┘
                                           │ Prisma
                                           ▼
                                    ┌──────────────┐
                                    │  PostgreSQL  │
                                    └──────┬───────┘
                                           │ finalize
                              ┌────────────┴───────────┐
                              ▼                        ▼
                       ┌────────────┐          ┌──────────────┐
                       │ Risk engine│ ───────▶ │Receipt engine│
                       │(deterministic)        │ SHA-256 +    │
                       └────────────┘          │ Ed25519 sign │
                                               └──────┬───────┘
                                                      ▼
                                               signed receipt
                                                      ▲
                                    ┌─────────────────┘
                                    │ reads + verifies
                              ┌────────────┐
                              │ Dashboard  │
                              └────────────┘
```

## Data model

`owners → agents → runs → events`, with `policies`, `approvals`, `artifacts`,
`attestations`, and `risk_flags` attached to runs (and optionally events).

See `prisma/schema.prisma`. Key constraints:

- `events(runId, seqNo)` unique - sequence numbers are unique within a run.
- `runs(agentId, runExternalId)` unique - idempotent external run ids.
- `policies(ownerId, name, version)` unique.

## Lifecycle

1. **Register** an owner and agent; optionally create a policy.
2. **Start** a run (`RUNNING`).
3. **Append** ordered events. Each must be the next sequence number; appends to
   a non-`RUNNING` run are rejected.
4. **Record** approvals (optionally bound to a specific event), artifacts, and
   attestations.
5. **Finalize** the run. This is a single transaction that:
   - verifies sequence continuity,
   - runs the deterministic risk engine,
   - persists risk flags and the rolled-up risk level,
   - builds the canonical receipt, chains event hashes, signs the run hash,
   - stores `receiptHash` + `receiptSignature` and flips status to `FINALIZED`.

After finalization the event log is frozen and the receipt is retrievable and
independently verifiable.

## Why tsx in production

The workspace consumes `@agenttrace/shared` as TypeScript source (its package
`main` points at `src`). To keep dev and prod module resolution identical, the
API process runs under `tsx` in both. The dashboard, by contrast, is bundled by
Next.js (with a webpack `extensionAlias` mapping `.js` → `.ts`).
