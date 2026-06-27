---
name: invariant-guard
description: Confirm the core AgentTrace invariants still hold after a change that touches the receipt engine, finalize, events, hashing, risk, or policy code. Use before shipping anything in apps/api/src/lib, apps/api/src/services, or packages/shared. Runs the targeted property and integration tests and checks the determinism, ordering, and finalization guarantees.
---

# invariant-guard

The product's value is its invariants. This skill checks they are intact.

## The invariants (from CLAUDE.md)

- Sequence numbers are unique within a run and appended in order.
- Finalized runs cannot receive new events.
- Finalize fails if sequence continuity is broken.
- Receipt generation is deterministic: same run yields the same runHash.
- Volatile fields (for example generatedAt) are excluded from the hashed body.
- Risk and policy flags are deterministic: no randomness, clock reads, or ML.
- Ed25519 primitives live in packages/shared so the SDK verifies without the API.

## Steps

1. Ensure the database is up (`db-up`).
2. Run the suites that encode these invariants:
   ```bash
   export DATABASE_URL="postgresql://agenttrace@localhost:5432/agenttrace?schema=public"
   pnpm --filter @agenttrace/api test
   ```
   The property tests in `apps/api/test/receipt.property.test.ts` cover
   determinism, single byte tamper detection, sequence rejection, ordering
   invariance, and version handling. `api.test.ts` covers ordering, append after
   finalize rejection, and the finalize flow.
3. If you changed hashing, ordering, or the receipt body shape, add or extend a
   property test that shuffles inputs and asserts an identical runHash and
   signature, and prove it fails on the old code and passes on the new one
   (falsifiability).

## Success criteria

All api tests pass, and any invariant you touched has a test that would fail if
the guarantee regressed.
