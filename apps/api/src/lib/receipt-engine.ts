import {
  chainEventHash,
  hashCanonical,
  HASH_ALGORITHM,
  RECEIPT_VERSION,
  receiptVersionOf,
  SIGNATURE_ALGORITHM,
  SUPPORTED_RECEIPT_VERSIONS,
  type Receipt,
  type ReceiptApprovalEntry,
  type ReceiptBody,
  type ReceiptEventEntry,
  type ReceiptRiskFlagEntry,
} from "@agenttrace/shared";
import type {
  Agent,
  Approval,
  Event,
  Policy,
  RiskFlag,
  Run,
} from "@prisma/client";
import { signMessage, verifySignature } from "../crypto/signing.js";
import { unprocessable } from "./errors.js";

export interface RunBundle {
  run: Run;
  agent: Agent;
  policy: Policy | null;
  events: Event[];
  approvals: Approval[];
  riskFlags: RiskFlag[];
}

export interface BuiltReceipt {
  receipt: Receipt;
  /** Per-event chain hashes, keyed by seqNo, to persist back onto events. */
  eventHashes: Map<number, { eventHash: string; prevEventHash: string | null }>;
}

/**
 * The deterministic core of an event. Only stable, evidence-bearing fields are
 * folded into the hash - database ids, createdAt timestamps and the chain
 * pointers themselves are excluded so the hash describes *what happened*, not
 * how it was stored.
 */
function eventCore(ev: Event) {
  return {
    runId: ev.runId,
    seqNo: ev.seqNo,
    eventType: ev.eventType,
    timestamp: ev.timestamp.toISOString(),
    actorType: ev.actorType,
    actorId: ev.actorId ?? null,
    toolName: ev.toolName ?? null,
    targetSystem: ev.targetSystem ?? null,
    actionClass: ev.actionClass,
    mutatesState: ev.mutatesState,
    irreversible: ev.irreversible,
    inputHash: ev.inputHash ?? null,
    outputHash: ev.outputHash ?? null,
    metadataJson: ev.metadataJson ?? {},
  };
}

/** Verify events form a gap-free sequence starting at the lowest seqNo. */
export function verifySequenceContinuity(events: Event[]): void {
  if (events.length === 0) return;
  const sorted = [...events].sort((a, b) => a.seqNo - b.seqNo);
  const seen = new Set<number>();
  let expected = sorted[0]!.seqNo;
  for (const ev of sorted) {
    if (seen.has(ev.seqNo)) {
      throw unprocessable(`Duplicate sequence number ${ev.seqNo}`);
    }
    seen.add(ev.seqNo);
    if (ev.seqNo !== expected) {
      throw unprocessable(
        `Sequence continuity broken: expected seqNo ${expected}, found ${ev.seqNo}`,
      );
    }
    expected += 1;
  }
}

/**
 * Build a deterministic, signed receipt for a run bundle.
 *
 * Pure given its inputs and the signing key: the same bundle always produces
 * the same runHash, and the signature is the only field that depends on the
 * key. `generatedAt` lives in the envelope and is excluded from the hash.
 */
export function buildReceipt(bundle: RunBundle, signingKeyHex: string, publicKeyHex: string): BuiltReceipt {
  const { run, agent, policy } = bundle;

  const orderedEvents = [...bundle.events].sort((a, b) => a.seqNo - b.seqNo);
  verifySequenceContinuity(orderedEvents);

  const eventHashes = new Map<
    number,
    { eventHash: string; prevEventHash: string | null }
  >();
  const receiptEvents: ReceiptEventEntry[] = [];

  let prevHash: string | null = null;
  for (const ev of orderedEvents) {
    const eventHash = chainEventHash(eventCore(ev), prevHash);
    eventHashes.set(ev.seqNo, { eventHash, prevEventHash: prevHash });
    receiptEvents.push({
      seqNo: ev.seqNo,
      eventType: ev.eventType,
      timestamp: ev.timestamp.toISOString(),
      actorType: ev.actorType,
      actionClass: ev.actionClass,
      toolName: ev.toolName ?? null,
      targetSystem: ev.targetSystem ?? null,
      mutatesState: ev.mutatesState,
      irreversible: ev.irreversible,
      inputHash: ev.inputHash ?? null,
      outputHash: ev.outputHash ?? null,
      prevEventHash: prevHash,
      eventHash,
    });
    prevHash = eventHash;
  }

  const seqByEventId = new Map(orderedEvents.map((e) => [e.id, e.seqNo]));
  // The seqNo an entity is bound to, or null for run-level / orphaned references.
  const seqForEventId = (eventId: string | null): number | null =>
    eventId ? (seqByEventId.get(eventId) ?? null) : null;
  // Sort key: run-level (null) and orphaned references share a fixed slot so
  // they order deterministically relative to event-bound entries.
  const RUNLEVEL_SORT = -1;
  const seqSortKey = (seqNo: number | null): number => seqNo ?? RUNLEVEL_SORT;

  const byNum = (a: number, b: number): number => (a < b ? -1 : a > b ? 1 : 0);
  const byStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  // Total ordering over content fields (all of which are in the hashed body) so
  // the same run always yields byte-identical approvals/riskFlags - and thus the
  // same runHash - regardless of the order rows came back from the database.
  // `approvedAt` stays the primary key (unchanged for the common distinct case);
  // the rest break ties that were previously resolved by nondeterministic scan
  // order (approvedAt defaults to now() and routinely collides).
  const approvals: ReceiptApprovalEntry[] = bundle.approvals
    .map((a) => ({
      eventSeqNo: seqForEventId(a.eventId),
      approverType: a.approverType,
      approverId: a.approverId,
      decision: a.decision,
      approvedAt: a.approvedAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        byStr(a.approvedAt, b.approvedAt) ||
        byNum(seqSortKey(a.eventSeqNo), seqSortKey(b.eventSeqNo)) ||
        byStr(a.approverType, b.approverType) ||
        byStr(a.approverId, b.approverId) ||
        byStr(a.decision, b.decision),
    );

  const riskFlags: ReceiptRiskFlagEntry[] = bundle.riskFlags
    .map((f) => ({
      flagType: f.flagType,
      severity: f.severity,
      eventSeqNo: seqForEventId(f.eventId),
      title: f.title,
    }))
    .sort(
      (a, b) =>
        byNum(seqSortKey(a.eventSeqNo), seqSortKey(b.eventSeqNo)) ||
        byStr(a.flagType, b.flagType) ||
        byStr(String(a.severity), String(b.severity)) ||
        byStr(a.title, b.title),
    );

  const body: ReceiptBody = {
    version: RECEIPT_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    run: {
      id: run.id,
      agentExternalId: agent.externalId,
      runExternalId: run.runExternalId ?? null,
      parentRunId: run.parentRunId ?? null,
      status: run.status,
      riskLevel: (run.riskLevel ?? "NONE") as ReceiptBody["run"]["riskLevel"],
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt ? run.endedAt.toISOString() : null,
    },
    agent: {
      externalId: agent.externalId,
      name: agent.name,
      environment: agent.environment,
    },
    policy: policy
      ? { name: policy.name, version: policy.version, policyHash: policy.policyHash }
      : null,
    eventCount: orderedEvents.length,
    events: receiptEvents,
    approvals,
    riskFlags,
  };

  const runHash = hashCanonical(body);
  const signature = signMessage(runHash, signingKeyHex);

  const receipt: Receipt = {
    receiptVersion: RECEIPT_VERSION,
    body,
    runHash,
    signature,
    signedBy: publicKeyHex,
    generatedAt: new Date().toISOString(),
  };

  return { receipt, eventHashes };
}

/** Independently verify a receipt: recompute the run hash and check the signature. */
export function verifyReceipt(receipt: Receipt): {
  hashValid: boolean;
  signatureValid: boolean;
} {
  // Reject formats this build does not understand before checking anything else.
  if (!SUPPORTED_RECEIPT_VERSIONS.includes(receiptVersionOf(receipt))) {
    return { hashValid: false, signatureValid: false };
  }
  const recomputed = hashCanonical(receipt.body);
  const hashValid = recomputed === receipt.runHash;
  const signatureValid = verifySignature(
    receipt.runHash,
    receipt.signature,
    receipt.signedBy,
  );
  return { hashValid, signatureValid };
}
