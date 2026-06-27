# API reference

Base URL: `http://localhost:4000`. JSON in/out. Writes require an API key via
`Authorization: Bearer <key>` or `x-api-key: <key>`.

Two key types are accepted:
- **Global/admin keys** - configured via `API_KEYS` (bootstrap, not tenant-scoped).
- **Per-owner keys** - minted via `POST /v1/owners/:id/api-keys`; the plaintext
  is returned exactly once and only its SHA-256 hash is stored. Using one sets
  the request's owner scope and updates the key's `lastUsedAt` (usage audit).

All endpoints are rate-limited per client IP (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`),
and responses carry `x-ratelimit-*` headers.

## Errors

```json
{ "error": "bad_request", "message": "Validation failed", "details": { } }
```

| Status | `error` | When |
| ------ | ------- | ---- |
| 400 | `bad_request` | validation failed |
| 401 | `unauthorized` | missing/invalid API key |
| 404 | `not_found` | resource missing |
| 409 | `conflict` | e.g. append after finalize, duplicate seqNo |
| 422 | `unprocessable` | out-of-order event, broken sequence continuity |

## Write endpoints

### POST /v1/owners
`{ type?: ORG|TEAM|USER|SERVICE, name, externalRef? }`

### POST /v1/agents
`{ externalId, name, ownerId, environment?, framework?, metadataJson? }`

### POST /v1/policies
`{ ownerId, name, version?, policyText, rules? }` → stores a `policyHash` that
binds the text **and** the structured rules.

`rules` is an optional, deterministic rule set (not a policy authoring system):
```jsonc
{
  "denyActionClasses": ["SECRET_ACCESS"],        // any such event => CRITICAL violation
  "requireApprovalFor": ["EXTERNAL_CALL"],       // mutating event of this class w/o approval => HIGH violation
  "forbidIrreversibleWithoutApproval": true       // unapproved irreversible event => CRITICAL violation
}
```
Evaluated at finalize; violations are recorded as `policy_violation` risk flags
on the run (and therefore in the receipt) and roll up into `riskLevel`.

### POST /v1/runs
`{ agentId, runExternalId?, parentRunId?, policyId?, startedAt? }`

### POST /v1/events
```
{ runId, seqNo, eventType, timestamp?, actorType?, actorId?,
  toolName?, targetSystem?,
  actionClass?: READ|WRITE|EXTERNAL_CALL|CODE_EXECUTION|SECRET_ACCESS|APPROVAL|CONTROL|OTHER,
  mutatesState?, irreversible?, inputHash?, outputHash?, metadataJson? }
```
The first event of a run must have `seqNo` 0 or 1; subsequent events must be
exactly the previous `seqNo + 1`.

### POST /v1/approvals
`{ runId, eventId?, approverType?, approverId, decision: APPROVED|REJECTED|ESCALATED|EXPIRED, reason?, approvedAt? }`

### POST /v1/attestations
`{ runId, attestationType?, subject, statement, evidenceRef? }` → server signs it (Ed25519).

### POST /v1/artifacts
`{ runId, eventId?, artifactType?, uri, sha256, contentPreview? }`

### POST /v1/runs/:id/finalize
`{ status?: FINALIZED|FAILED|ABORTED, endedAt? }` →
`{ receipt, riskLevel }`. Idempotency: a non-`RUNNING` run returns 409.

### POST /v1/owners/:id/api-keys
`{ name }` → `{ id, ownerId, name, prefix, key }`. The `key` plaintext is shown
**once**. List with `GET /v1/owners/:id/api-keys` (metadata only, auth required);
revoke with `DELETE /v1/owners/:id/api-keys/:keyId`.

## Read endpoints (no auth)

- `GET /v1/agents?limit=&offset=` → `{ items, total, limit, offset }`
- `GET /v1/agents/:id`
- `GET /v1/agents/:id/runs`
- `GET /v1/runs?limit=&offset=`
- `GET /v1/runs/:id` → run with events, approvals, artifacts, attestations, riskFlags
- `GET /v1/runs/:id/receipt` → signed receipt JSON (409 if not finalized)
- `GET /v1/runs/:id/receipt/verify` → server-side verification (409 if not finalized):
  ```json
  { "runId": "...", "sealedHash": "...", "recomputedHash": "...",
    "hashValid": true, "signatureValid": true, "valid": true }
  ```
  Recomputes the run hash from current evidence and compares it to the sealed
  receipt. `hashValid` is `false` if any event was mutated after finalization.
- `GET /v1/runs/:id/export` → complete, self-contained evidence bundle as a
  downloadable JSON file: `{ exportedAt, run (full trail), receipt, verification }`.
- `GET /health`

## Deterministic risk flags

Computed at finalize: `external_write`, `secret_access`, `code_execution`,
`approval_missing`, `irreversible_action`, `policy_missing`, `ambiguous_target`,
`rollback_unavailable`, and `policy_violation` (from bound policy rules). See
`packages/shared/src/risk.ts` and `packages/shared/src/policy.ts`.
