# API reference

Base URL: `http://localhost:4000`. JSON in/out. Writes require an API key via
`Authorization: Bearer <key>` or `x-api-key: <key>`.

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
`{ ownerId, name, version?, policyText }` → stores a `policyHash`.

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

## Read endpoints (no auth)

- `GET /v1/agents?limit=&offset=` → `{ items, total, limit, offset }`
- `GET /v1/agents/:id`
- `GET /v1/agents/:id/runs`
- `GET /v1/runs?limit=&offset=`
- `GET /v1/runs/:id` → run with events, approvals, artifacts, attestations, riskFlags
- `GET /v1/runs/:id/receipt` → signed receipt JSON (409 if not finalized)
- `GET /health`

## Deterministic risk flags

Computed at finalize: `external_write`, `secret_access`, `code_execution`,
`approval_missing`, `irreversible_action`, `policy_missing`, `ambiguous_target`,
`rollback_unavailable`. See `packages/shared/src/risk.ts`.
