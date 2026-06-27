---
name: security-pass
description: Review AgentTrace for security and robustness issues before shipping. Use on the current diff after touching auth, routes, input handling, crypto, or the API surface, and periodically on the whole codebase. Checks authz and API keys, input validation, secret handling, header hygiene, error leakage, and multi tenant data exposure, and reports concrete findings with file references.
---

# security-pass

AgentTrace is a trust and evidence product, so its own security posture matters.

## What to check

1. Auth and keys
   - Write routes require an API key (`requireApiKey` preHandler). Per owner keys
     are SHA-256 hashed, shown once, revocable.
   - The signing key is required in production (`getKeystore` throws if missing
     when NODE_ENV is production).
2. Input validation
   - Every write route parses a Zod schema from `@agenttrace/shared` before use.
   - Bounds on free text fields (names, policyText, reasons).
3. Secret handling
   - Receipts embed hashes, not raw content. No secrets in logs or error bodies.
   - The error handler returns generic messages for unexpected errors.
4. Headers and transport
   - `@fastify/helmet` sets nosniff, frameguard, referrer policy, HSTS, with a
     cross origin resource policy so the dashboard can still read responses.
   - CORS is allow list configurable via CORS_ORIGINS.
5. Multi tenant exposure (known design note)
   - Read endpoints are currently public and not owner scoped. Receipts are meant
     to be publicly verifiable, but listing all runs/agents leaks cross tenant
     metadata. Flag this for explicit owner scoping when read auth is introduced;
     it is architecturally significant, so propose a migration path rather than
     break the dashboard's current no auth reads.

## Output

A short list of concrete findings (file:line, the risk, a suggested fix, and a
severity). Implement the small, safe ones via the normal round flow; surface the
larger ones for a decision rather than half implementing them.
