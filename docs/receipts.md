# Receipts

A receipt is the verifiable proof that a run happened as recorded. It is
deterministic, signed, and verifiable without the server.

## Determinism

- **Canonicalization** (`canonicalize`) serializes any value with recursively
  sorted object keys and dropped `undefined`s, so the same logical value always
  produces the same bytes.
- **Event hashing** folds a stable subset of each event (the "event core") with
  the previous event's hash:

  ```
  eventHash = SHA-256( canonical(eventCore) + "." + (prevEventHash ?? "") )
  ```

  This forms a tamper-evident chain — changing any earlier event invalidates
  every hash after it. Database ids, `createdAt`, and the chain pointers
  themselves are excluded from `eventCore`.
- **Run hash** is `SHA-256(canonical(receiptBody))`. The body excludes volatile
  fields (e.g. `generatedAt`), so re-deriving a receipt yields the same hash.

## Signing

The run hash is signed with **Ed25519**. The receipt carries the signature and
the signer's public key:

```json
{
  "body": { "version": "agenttrace.receipt.v1", "...": "..." },
  "runHash": "<sha256 hex>",
  "signature": "<ed25519 hex>",
  "signedBy": "<public key hex>",
  "generatedAt": "<iso>"
}
```

## Verification

`verifyReceipt(receipt)` (exported from `@agenttrace/shared` and the SDK):

1. recomputes `SHA-256(canonical(body))` and compares to `runHash` → `hashValid`
2. verifies the Ed25519 `signature` over `runHash` using `signedBy` →
   `signatureValid`

Both true ⇒ `valid`. No server, private key, or database required.

```ts
import { verifyReceipt } from "@agenttrace/shared";
const result = verifyReceipt(receipt); // { hashValid, signatureValid, valid }
```

The dashboard's receipt page performs this check server-side and shows the
result, so the UI never has to trust the API's word.

## Tamper-evidence

`GET /v1/runs/:id/receipt/verify` (and `sdk.getReceiptVerification(runId)`)
recomputes the run hash from the **current** persisted events and compares it to
the hash sealed at finalize time:

```json
{ "sealedHash": "…", "recomputedHash": "…", "hashValid": true,
  "signatureValid": true, "valid": true }
```

If any event is mutated after finalization, the recomputed hash diverges from
the seal and `hashValid` becomes `false`. This is covered by an integration test
that edits a sealed event directly in the database and asserts verification
fails.

## Keys

Generate a stable keypair with `pnpm keys:generate` and set
`RECEIPT_SIGNING_KEY` (and optionally `RECEIPT_PUBLIC_KEY`). Without a configured
key, the API generates an **ephemeral** key in development and warns — receipts
signed with it will not verify after a restart. In production a key is required.
