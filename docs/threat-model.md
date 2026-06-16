# Threat model & what a receipt does (and does not) prove

AgentTrace's pitch is *proof*. Proof is only meaningful when its scope is stated
precisely. This document is that statement. If any other doc or string in the
repo claims more than what is written here, the other doc is wrong.

## The one-sentence version

> A receipt proves that **the event trail the agent reported** was sealed under
> the signing key and has not been altered since. It does **not** prove that the
> reported trail is **complete** — i.e. that the agent reported everything it did.

## Trust boundary

The trust boundary is **at ingestion**. AgentTrace records what is sent to its
ingestion API. Everything upstream of that — the agent, its tools, the host —
is outside the boundary and is trusted to report honestly. AgentTrace is an
*evidence recorder*, not a *runtime sandbox* or an interceptor.

```
   agent + tools            │ AgentTrace
  (trusted to report)       │ (records, hashes, signs)
   ───────────────────►  ingestion API ──► event trail ──► signed receipt
                            │
                   trust boundary
```

## Adversary classes

| Adversary | Capability | Does AgentTrace defend? |
| --- | --- | --- |
| **Curious outsider** | Reads receipts / API responses | **Yes.** Receipts carry no secrets; the signature is verifiable with only the public key. Tampering with a receipt is detected (signature fails). |
| **The Owner (after the fact)** | Wants to rewrite history to look better later | **Yes.** Events are hash-chained and the run hash is signed at finalize. Editing a stored event makes the recomputed hash diverge from the sealed hash (`hashValid: false`), and re-signing requires the private key. This is the core tamper-evidence property. |
| **Malicious insider with DB access** | Can edit/delete rows directly | **Detected, not prevented.** They can mutate the database, but `…/receipt/verify` recomputes the hash from current rows and flags the divergence. Without the signing key they cannot forge a matching signature. (If they hold the signing key, all bets are off — protect it.) |
| **Buggy or compromised agent that hides actions** | Performs actions it never reports | **No — by design.** See completeness below. |

## What a receipt **proves**

Given a receipt and the public key, a verifier can establish, offline:

1. **Integrity** — the reported event trail (and the run/agent/policy context in
   the hashed body) is exactly what was sealed at finalize time. Any later edit
   to a stored event is detected (`hashValid` becomes false).
2. **Authenticity** — the run hash was signed by the holder of the private key
   (`signatureValid`).
3. **No-dropped-reported-events** — sequence numbers are unique and contiguous
   within a run, and finalize fails on a broken sequence. So you cannot silently
   remove a reported event from the middle of the trail without detection.
4. **Determinism** — the same logical run always produces the same `runHash`,
   so the receipt is independently reproducible from the evidence.

## What a receipt does **NOT** prove

- **Completeness.** A run only ever emits events for actions the agent *chose to
  report*. Nothing in the system observes the agent's actual side effects, so a
  receipt **cannot prove the absence of unreported actions**. An agent that
  reads a secret and never reports it produces a clean-looking receipt.
- **Correctness of the reported content.** If the agent reports `actionClass:
  READ` for something that was actually a write, the receipt faithfully seals the
  *misreport*. AgentTrace proves what was said, not that what was said is true.
- **Real-world effect / liveness.** A receipt is post-hoc evidence, not a control
  that blocks or sandboxes an action.

## Intended use

AgentTrace is built for **"honest-but-must-prove-it"** situations:

- compliance, audit, and GRC trails for agent activity;
- post-hoc incident review ("what did the agent report doing, and was that
  record tampered with afterwards?");
- binding an agent's reported actions to the policy and approvals in force.

It is **not** designed to catch an adversarial agent that deliberately hides its
own actions — that requires runtime interception/sandboxing, which is explicitly
out of scope (see the v0 boundaries in `CLAUDE.md`). To raise assurance about
completeness, push the trust boundary outward (e.g. instrument the tool layer so
the *tools*, not the agent, emit events), but that is an integration choice on
top of AgentTrace, not a property of the receipt itself.

## See also

- [`docs/receipts.md`](receipts.md) — receipt format and the verify paths.
- [`docs/security-checklist.md`](security-checklist.md) — integration hardening.
- [`docs/quickstart.md`](quickstart.md) — produce a verifying receipt yourself.
