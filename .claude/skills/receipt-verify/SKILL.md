---
name: receipt-verify
description: Verify an AgentTrace receipt independently, offline, with no API or database. Use to check the core promise of the product, to confirm a receipt a user shares is genuine, or to validate output from a change to the receipt or crypto code. Recomputes the SHA-256 run hash, checks the Ed25519 signature, and confirms the receipt version is supported.
---

# receipt-verify

Anyone holding a receipt can verify it with only the public key. This skill does
exactly that.

## Options

1. Offline CLI (no server, no key):
   ```bash
   # Save a receipt to a file, then:
   pnpm verify:receipt receipt.json
   # or pipe it:
   curl -s http://localhost:4000/v1/runs/<id>/receipt | pnpm verify:receipt -
   ```
   Exit 0 means valid, exit 1 means invalid.

2. Programmatic (shared verifier, what the dashboard /verify page uses):
   ```ts
   import { verifyReceipt } from "@agenttrace/shared";
   const v = verifyReceipt(receipt);
   // { hashValid, signatureValid, versionSupported, valid }
   ```

## What it proves

- hashValid: the recomputed SHA-256 of the canonical body equals the sealed runHash.
- signatureValid: the Ed25519 signature over runHash verifies against signedBy.
- versionSupported: the receiptVersion is one this build understands.

## What it does not prove

Completeness. A receipt covers the events the agent reported, not every action it
took. See docs/threat-model.md before relying on it.
