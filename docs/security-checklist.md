# AgentTrace Security Checklist for Agent Integrations

AgentTrace integrations should be designed so that every meaningful agent action
is **attributable, bounded, reviewable, and reconstructable** after the fact.
Production risk comes from the interaction of identity, memory, tool use, and
runtime permissions - not from prompt injection alone.

## Scope

For teams integrating autonomous or semi-autonomous agents with AgentTrace. The
goal is a minimum security baseline before production rollout, with emphasis on
authorization, provenance, telemetry hygiene, and containment.

## Identity and delegation

- [ ] Every agent has a distinct identity; no shared service principal across unrelated agents.
- [ ] Every agent is mapped to a clear owner, tenant, or delegating human/service.
- [ ] Delegation scope is explicit: what the agent may do, on which systems, for how long, and for whom.
- [ ] Credentials are short-lived where possible and rotated regularly.
- [ ] Emergency revocation path exists for each agent credential.

> In AgentTrace: each `Agent` has a unique `externalId` and belongs to an
> `Owner` (`ORG | TEAM | USER | SERVICE`). Bind every run to its agent and
> owner so attribution is unambiguous.

## Tool and permission boundaries

- [ ] Tools are allowlisted per agent role rather than globally exposed.
- [ ] Read operations and write operations are classified separately.
- [ ] Irreversible or high-impact actions require additional checks or approval.
- [ ] Each tool call enforces authorization at execution time, not only at setup time.
- [ ] Resource scoping is narrow - per repo, per project, per customer, or per environment.

> In AgentTrace: classify each event with `actionClass` (`READ | WRITE |
> EXTERNAL_CALL | CODE_EXECUTION | SECRET_ACCESS | …`), and set `mutatesState`
> and `irreversible`. The deterministic risk engine flags
> `external_write`, `irreversible_action`, `rollback_unavailable`,
> `secret_access`, and `code_execution` from these fields.

## Prompt, context, and memory safety

- [ ] External content is treated as untrusted by default - documents, webpages, email, retrieved context, API responses.
- [ ] Retrieved context is labeled by source and trust tier before it influences action decisions.
- [ ] System instructions are separated from retrieved or user-supplied content.
- [ ] Memory writes are constrained and reviewed for sensitive workflows.
- [ ] Cross-user or cross-tenant memory contamination is prevented by isolation boundaries.
- [ ] Sensitive or policy-like documents cannot silently become authoritative memory without provenance.

> In AgentTrace: record provenance for context that influenced a decision via
> `Artifact` rows (`uri` + `sha256` + optional `contentPreview`) attached to the
> event that consumed them.

## Approval and human oversight

- [ ] Approval is required for actions with financial, legal, destructive, or external side effects.
- [ ] Approval records include approver identity, timestamp, and decision reason.
- [ ] Approval state is bound to the specific action or event, not only to the run in general.
- [ ] Expired or stale approvals cannot be reused for a later run.
- [ ] A deny decision blocks execution deterministically.

> In AgentTrace: `Approval` rows carry `approverType`, `approverId`, `decision`
> (`APPROVED | REJECTED | ESCALATED | EXPIRED`), `reason`, and `approvedAt`, and
> bind to a specific `eventId`. The risk engine raises `approval_missing` for
> high-impact mutating events that lack an `APPROVED` approval.

## AgentTrace event requirements

Every important event reported to AgentTrace should capture the fields below so
post-incident reconstruction is possible and responsibility can be assigned with
less ambiguity.

| Requirement | Field(s) in AgentTrace |
| ----------- | ---------------------- |
| Agent identity | `run.agent.externalId` |
| Delegating owner / principal | `agent.owner` |
| Run identifier | `event.runId` |
| Event sequence number | `event.seqNo` |
| Timestamp | `event.timestamp` |
| Tool name and target system | `event.toolName`, `event.targetSystem` |
| Action class + mutation | `event.actionClass`, `event.mutatesState` |
| Approval requirement and state | `Approval` (bound via `eventId`) |
| Policy identifier / rule reference | `run.policyId`, `policy.policyHash` |
| Input/output hashes or previews | `event.inputHash`, `event.outputHash`, `Artifact.contentPreview` |
| Risk flags / control outcomes | `RiskFlag` rows + `run.riskLevel` |

## Telemetry and data hygiene

- [ ] Secrets are redacted from traces, logs, and receipts.
- [ ] PII is minimized or masked before export to third-party observability systems.
- [ ] Full raw prompts and outputs are stored only when there is a clear operational need.
- [ ] Evidence payloads prefer hashes, metadata, and previews over unrestricted raw content.
- [ ] Access to full traces is role-restricted in dashboards and exports.
- [ ] Retention periods for sensitive traces and artifacts are defined and enforced.

> In AgentTrace: prefer `inputHash` / `outputHash` over raw payloads. Receipts
> embed hashes, not content - so a receipt proves *what happened* without
> leaking the underlying data.

## Runtime controls and containment

- [ ] Retry loops, recursion depth, and tool chaining limits are enforced.
- [ ] There is a kill switch or containment mechanism for suspicious or out-of-scope behavior.
- [ ] Agents cannot continue executing after a policy violation without explicit override.
- [ ] Finalized runs are tamper-evident from an audit perspective (later edits
      are *detectable*, not prevented - see the [threat model](threat-model.md)).
- [ ] Integrity checks exist for event ordering and receipt generation.

> In AgentTrace: appends to a non-`RUNNING` run are rejected, finalize verifies
> gap-free sequence continuity, and every finalized run produces a signed,
> hash-chained receipt. These are enforced invariants, not conventions. They
> cover the *reported* trail only - AgentTrace does not prove completeness; see
> the [threat model](threat-model.md).

## Validation before production

- [ ] Test a prompt injection attempt against an agent with real tools and verify bounded execution.
- [ ] Test a poisoned memory or malicious retrieved-context scenario.
- [ ] Test missing-approval behavior and confirm the action is blocked.
- [ ] Test that high-risk write events are visible in AgentTrace with the right metadata.
- [ ] Test receipt verification and post-run audit reconstruction using only recorded evidence.

## Minimum go-live rule

A production agent should not go live unless the integrating team can answer four
questions for any important action:

1. **Who authorized it?** - owner + approval bound to the event
2. **What context influenced it?** - artifacts + provenance
3. **What system did it touch?** - target system + action class
4. **What evidence proves it occurred under the intended policy boundary?** - signed receipt + policy hash

If all four are answerable from recorded AgentTrace evidence alone, the
integration meets the baseline.
