---
name: improvement-scan
description: Pick the single highest value to risk improvement to ship next for AgentTrace. Use at the start of an autonomous build round when you need to decide what to work on. Runs a multi dimension analysis (read only reviewers across correctness, security, UX, testing, DX/docs, robustness) and an adversarial ranking pass, then returns one concrete, shippable improvement with a plan.
---

# improvement-scan

Replaces guessing about what to build with a rigorous, repeatable selection.

## How

Launch a Workflow (multi agent orchestration is the point of this skill) that:

1. Phase "Analyze": run 6 read only dimension reviewers in parallel, one each for
   correctness/bugs, security/robustness, dashboard UX and design, testing gaps,
   developer experience and docs coherence, and operational robustness. Each
   explores the real code under `/home/user/AgentTrace` and returns 2 to 4
   concrete candidates with value(1 to 5), risk(1 to 5), effort(1 to 5),
   a grounded rationale, and the files involved.
2. Phase "Rank": one adversarial staff engineer dedupes overlaps and picks the
   single best value to risk improvement that is shippable as one focused PR and
   fully verifiable locally. It must reject anything architecturally significant
   that would break passing tests or the dashboard's current no auth reads
   without a migration path.

Respect the v0 boundaries in CLAUDE.md: no blockchain, billing, SSO, ML/anomaly
scoring, policy authoring DSL, agent framework, or chatbot. Prefer changes that
round out the existing product.

## Output

A top improvement with: title, dimension, why it is the best pick now, a concrete
step by step plan, the files, the risks and mitigation, and how to verify with
real evidence. Carry that into implementation, then `verify-baseline`, `ship-pr`,
and `round-summary`.
