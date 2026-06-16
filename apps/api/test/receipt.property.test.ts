import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Agent, Event, Run } from "@prisma/client";
import { buildReceipt, type RunBundle } from "../src/lib/receipt-engine.js";
import { getKeystore } from "../src/crypto/keystore.js";
import { verifyReceipt } from "@agenttrace/shared";

// Real Ed25519 keys + real hashing/signing — nothing is mocked here.
const { privateKeyHex, publicKeyHex } = getKeystore();

const ACTION_CLASSES = ["READ", "WRITE", "EXTERNAL_CALL", "CODE_EXECUTION", "SECRET_ACCESS", "CONTROL", "OTHER"] as const;

const agent: Agent = {
  id: "agent-1",
  externalId: "agent-ext",
  name: "Agent",
  ownerId: "owner-1",
  environment: "production",
  framework: null,
  metadataJson: {},
  createdAt: new Date("2026-01-01T00:00:00Z"),
} as Agent;

const run: Run = {
  id: "run-1",
  agentId: "agent-1",
  runExternalId: "run-ext",
  parentRunId: null,
  policyId: null,
  status: "FINALIZED",
  riskLevel: "LOW",
  startedAt: new Date("2026-01-01T00:00:00Z"),
  endedAt: new Date("2026-01-01T00:05:00Z"),
  receiptHash: null,
  receiptSignature: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
} as Run;

function makeEvent(seqNo: number, e: { eventType: string; actionClass: string; mutatesState: boolean; irreversible: boolean }): Event {
  return {
    id: `ev-${seqNo}`,
    runId: "run-1",
    seqNo,
    eventType: e.eventType,
    timestamp: new Date(`2026-01-01T00:0${Math.min(seqNo, 9)}:00Z`),
    actorType: "AGENT",
    actorId: "agent:ext",
    toolName: null,
    targetSystem: null,
    actionClass: e.actionClass,
    mutatesState: e.mutatesState,
    irreversible: e.irreversible,
    inputHash: null,
    outputHash: null,
    eventHash: null,
    prevEventHash: null,
    metadataJson: {},
    createdAt: new Date("2026-01-01T00:00:00Z"),
  } as unknown as Event;
}

const eventSpec = fc.record({
  eventType: fc.constantFrom("run_started", "read", "write", "call", "exec", "done"),
  actionClass: fc.constantFrom(...ACTION_CLASSES),
  mutatesState: fc.boolean(),
  irreversible: fc.boolean(),
});

/** A contiguous, ordered event list (seqNo 0..n-1). */
const eventListArb = fc.array(eventSpec, { minLength: 1, maxLength: 8 }).map((specs) =>
  specs.map((s, i) => makeEvent(i, s)),
);

function bundleOf(events: Event[]): RunBundle {
  return { run, agent, policy: null, events, approvals: [], riskFlags: [] };
}
const hashOf = (events: Event[]) => buildReceipt(bundleOf(events), privateKeyHex, publicKeyHex).receipt.runHash;

describe("receipt engine — property based", () => {
  it("is deterministic: the same run finalized repeatedly yields identical hash AND signature", () => {
    fc.assert(
      fc.property(eventListArb, (events) => {
        const a = buildReceipt(bundleOf(events), privateKeyHex, publicKeyHex).receipt;
        const b = buildReceipt(bundleOf(events), privateKeyHex, publicKeyHex).receipt;
        expect(b.runHash).toBe(a.runHash);
        expect(b.signature).toBe(a.signature);
      }),
    );
  });

  it("rejects two events sharing a seqNo within a run", () => {
    fc.assert(
      fc.property(eventListArb, fc.nat(), (events, k) => {
        const dup = makeEvent(events[0]!.seqNo, { eventType: "dup", actionClass: "READ", mutatesState: false, irreversible: false });
        const withDup = [...events];
        withDup.splice(k % (withDup.length + 1), 0, dup); // insert a duplicate seqNo
        expect(() => buildReceipt(bundleOf(withDup), privateKeyHex, publicKeyHex)).toThrow();
      }),
    );
  });

  it("flipping a single event field changes the run hash", () => {
    fc.assert(
      fc.property(eventListArb, fc.nat(), (events, idx) => {
        const before = hashOf(events);
        const i = idx % events.length;
        const mutated = events.map((e, j) =>
          j === i ? makeEvent(e.seqNo, { eventType: e.eventType, actionClass: e.actionClass, mutatesState: !e.mutatesState, irreversible: e.irreversible }) : e,
        );
        expect(hashOf(mutated)).not.toBe(before);
      }),
    );
  });

  it("changing which event holds which seqNo changes the receipt", () => {
    fc.assert(
      fc.property(eventListArb.filter((e) => e.length >= 2), (events) => {
        const before = hashOf(events);
        // Swap the content of seqNo 0 and seqNo 1 (reassign sequence positions).
        const swapped = events.map((e) => e);
        const a = events[0]!;
        const b = events[1]!;
        swapped[0] = makeEvent(0, { eventType: b.eventType, actionClass: b.actionClass, mutatesState: b.mutatesState, irreversible: b.irreversible });
        swapped[1] = makeEvent(1, { eventType: a.eventType, actionClass: a.actionClass, mutatesState: a.mutatesState, irreversible: a.irreversible });
        // If the two events are identical in content, the hash legitimately stays equal.
        const sameContent = a.eventType === b.eventType && a.actionClass === b.actionClass && a.mutatesState === b.mutatesState && a.irreversible === b.irreversible;
        if (sameContent) return;
        expect(hashOf(swapped)).not.toBe(before);
      }),
    );
  });

  it("catches a deliberately introduced post-finalize mutation, and verifies the untampered receipt", () => {
    fc.assert(
      fc.property(eventListArb, (events) => {
        const receipt = buildReceipt(bundleOf(events), privateKeyHex, publicKeyHex).receipt;

        // Untampered: real verification passes.
        const ok = verifyReceipt(receipt);
        expect(ok.valid).toBe(true);
        expect(ok.versionSupported).toBe(true);

        // Tamper: flip a byte of the body (an event type) without re-signing.
        const tampered = structuredClone(receipt);
        tampered.body.events[0]!.eventType = tampered.body.events[0]!.eventType + "X";
        const bad = verifyReceipt(tampered);
        expect(bad.hashValid).toBe(false);
        expect(bad.valid).toBe(false);
      }),
    );
  });

  it("rejects receipts with an unknown version", () => {
    const receipt = buildReceipt(bundleOf([makeEvent(0, { eventType: "x", actionClass: "READ", mutatesState: false, irreversible: false })]), privateKeyHex, publicKeyHex).receipt;
    expect(verifyReceipt(receipt).valid).toBe(true);

    const future = structuredClone(receipt);
    future.receiptVersion = "agenttrace.receipt.v999";
    const res = verifyReceipt(future);
    expect(res.versionSupported).toBe(false);
    expect(res.valid).toBe(false);
  });
});
