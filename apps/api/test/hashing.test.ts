import { describe, expect, it } from "vitest";
import {
  canonicalize,
  chainEventHash,
  generateKeyPair,
  hashCanonical,
  signMessage,
  verifySignature,
} from "@agenttrace/shared";

describe("deterministic hashing", () => {
  it("canonicalizes objects independent of key order", () => {
    const a = canonicalize({ b: 1, a: 2, c: { y: 1, x: 2 } });
    const b = canonicalize({ c: { x: 2, y: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":{"x":2,"y":1}}');
  });

  it("produces a stable hash for the same logical value", () => {
    const h1 = hashCanonical({ x: 1, y: [1, 2, 3] });
    const h2 = hashCanonical({ y: [1, 2, 3], x: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the hash when any field changes", () => {
    expect(hashCanonical({ a: 1 })).not.toBe(hashCanonical({ a: 2 }));
  });

  it("chains event hashes so tampering propagates", () => {
    const e1 = chainEventHash({ seqNo: 0, type: "a" }, null);
    const e2 = chainEventHash({ seqNo: 1, type: "b" }, e1);
    const e2Again = chainEventHash({ seqNo: 1, type: "b" }, e1);
    expect(e2).toBe(e2Again);

    // Tampering with the first event changes the second link.
    const tampered1 = chainEventHash({ seqNo: 0, type: "X" }, null);
    const e2FromTampered = chainEventHash({ seqNo: 1, type: "b" }, tampered1);
    expect(e2FromTampered).not.toBe(e2);
  });
});

describe("ed25519 signing", () => {
  it("verifies a valid signature and rejects tampering", () => {
    const { privateKeyHex, publicKeyHex } = generateKeyPair();
    const message = hashCanonical({ run: "r1", events: 8 });
    const sig = signMessage(message, privateKeyHex);

    expect(verifySignature(message, sig, publicKeyHex)).toBe(true);
    expect(verifySignature(message + "0", sig, publicKeyHex)).toBe(false);

    const other = generateKeyPair();
    expect(verifySignature(message, sig, other.publicKeyHex)).toBe(false);
  });
});
