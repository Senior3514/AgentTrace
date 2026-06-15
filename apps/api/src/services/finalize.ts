import type { FinalizeRunInput } from "@agenttrace/shared";
import {
  assessRisk,
  hashCanonical,
  policyRulesSchema,
  RunStatus,
  verifySignature,
  type RiskEventInput,
} from "@agenttrace/shared";
import type { Receipt } from "@agenttrace/shared";
import { prisma } from "../db.js";
import { getKeystore } from "../crypto/keystore.js";
import { getRunDetail } from "./runs.js";
import { conflict, notFound } from "../lib/errors.js";
import { buildReceipt, type RunBundle } from "../lib/receipt-engine.js";

/**
 * Finalize a run: freeze the event log, run deterministic risk evaluation,
 * generate and sign the receipt, and persist the chained event hashes.
 *
 * Everything happens in a single transaction so a run is either fully
 * finalized (with a verifiable receipt) or untouched.
 */
export async function finalizeRun(
  runId: string,
  input: FinalizeRunInput,
): Promise<{ receipt: Receipt; riskLevel: string }> {
  const { privateKeyHex, publicKeyHex } = getKeystore();

  return prisma.$transaction(async (tx) => {
    const run = await tx.run.findUnique({
      where: { id: runId },
      include: { agent: true, policy: true },
    });
    if (!run) throw notFound(`Run ${runId} not found`);
    if (run.status !== RunStatus.RUNNING) {
      throw conflict(`Run ${runId} is already ${run.status} and cannot be finalized again`);
    }

    const events = await tx.event.findMany({
      where: { runId },
      orderBy: { seqNo: "asc" },
    });
    const approvals = await tx.approval.findMany({ where: { runId } });

    // Which events carry an explicit APPROVED approval.
    const approvedEventIds = new Set(
      approvals
        .filter((a) => a.decision === "APPROVED" && a.eventId)
        .map((a) => a.eventId as string),
    );

    // --- Deterministic risk evaluation ---
    const riskEvents: RiskEventInput[] = events.map((ev) => ({
      seqNo: ev.seqNo,
      eventType: ev.eventType,
      actionClass: ev.actionClass as RiskEventInput["actionClass"],
      toolName: ev.toolName,
      targetSystem: ev.targetSystem,
      mutatesState: ev.mutatesState,
      irreversible: ev.irreversible,
      metadataJson: (ev.metadataJson ?? {}) as Record<string, unknown>,
      hasApproval: approvedEventIds.has(ev.id),
    }));
    // Parse the bound policy's structured rules (tolerant of legacy/empty).
    const policyRules = run.policy
      ? policyRulesSchema.safeParse(run.policy.rulesJson)
      : undefined;
    const assessment = assessRisk({
      hasPolicy: Boolean(run.policyId),
      events: riskEvents,
      policyRules: policyRules?.success ? policyRules.data : undefined,
    });

    const seqToEventId = new Map(events.map((e) => [e.seqNo, e.id]));

    // Replace any previously computed flags (finalize is one-shot, but stay idempotent).
    await tx.riskFlag.deleteMany({ where: { runId } });
    if (assessment.flags.length > 0) {
      await tx.riskFlag.createMany({
        data: assessment.flags.map((f) => ({
          runId,
          eventId: f.eventSeqNo !== null ? (seqToEventId.get(f.eventSeqNo) ?? null) : null,
          flagType: f.flagType,
          severity: f.severity as never,
          title: f.title,
          description: f.description,
        })),
      });
    }
    const riskFlags = await tx.riskFlag.findMany({ where: { runId } });

    const endedAt = input.endedAt ?? new Date();
    const runForReceipt = {
      ...run,
      status: input.status,
      riskLevel: assessment.riskLevel,
      endedAt,
    };

    // --- Build + sign receipt ---
    const bundle: RunBundle = {
      run: runForReceipt as RunBundle["run"],
      agent: run.agent,
      policy: run.policy,
      events,
      approvals,
      riskFlags,
    };
    const { receipt, eventHashes } = buildReceipt(bundle, privateKeyHex, publicKeyHex);

    // Persist chained event hashes.
    for (const ev of events) {
      const chain = eventHashes.get(ev.seqNo);
      if (chain) {
        await tx.event.update({
          where: { id: ev.id },
          data: { eventHash: chain.eventHash, prevEventHash: chain.prevEventHash },
        });
      }
    }

    await tx.run.update({
      where: { id: runId },
      data: {
        status: input.status as never,
        endedAt,
        riskLevel: assessment.riskLevel as never,
        receiptHash: receipt.runHash,
        receiptSignature: receipt.signature,
      },
    });

    return { receipt, riskLevel: assessment.riskLevel };
  });
}

/**
 * Rebuild a run's receipt JSON from persisted state (read-only). Used by the
 * receipt endpoint for finalized runs.
 */
export async function getReceipt(runId: string): Promise<Receipt> {
  const { privateKeyHex, publicKeyHex } = getKeystore();
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { agent: true, policy: true },
  });
  if (!run) throw notFound(`Run ${runId} not found`);
  if (run.status === RunStatus.RUNNING || !run.receiptHash) {
    throw conflict(`Run ${runId} is not finalized; no receipt available`);
  }

  const events = await prisma.event.findMany({ where: { runId }, orderBy: { seqNo: "asc" } });
  const approvals = await prisma.approval.findMany({ where: { runId } });
  const riskFlags = await prisma.riskFlag.findMany({ where: { runId } });

  const { receipt } = buildReceipt(
    { run, agent: run.agent, policy: run.policy, events, approvals, riskFlags },
    privateKeyHex,
    publicKeyHex,
  );

  // Prefer the persisted signature/hash so the receipt reflects what was sealed
  // at finalize time, even if it is being re-rendered later.
  return {
    ...receipt,
    runHash: run.receiptHash,
    signature: run.receiptSignature ?? receipt.signature,
  };
}

export interface RunVerification {
  runId: string;
  /** Run hash sealed at finalize time. */
  sealedHash: string;
  /** Run hash recomputed from the current persisted events. */
  recomputedHash: string;
  /** True when the recomputed hash matches the sealed hash (no tampering). */
  hashValid: boolean;
  /** True when the sealed signature verifies against the sealed hash. */
  signatureValid: boolean;
  /** True only when both checks pass. */
  valid: boolean;
}

/**
 * Verify a finalized run's evidence server-side.
 *
 * Recomputes the canonical run hash from the *current* persisted events and
 * compares it to the hash sealed at finalize time. If any event was mutated
 * after finalization, the recomputed hash diverges and `hashValid` is false —
 * this is the tamper-evidence guarantee. The Ed25519 signature is also checked
 * against the sealed hash.
 */
export async function getRunVerification(runId: string): Promise<RunVerification> {
  const { privateKeyHex, publicKeyHex } = getKeystore();
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { agent: true, policy: true },
  });
  if (!run) throw notFound(`Run ${runId} not found`);
  if (run.status === RunStatus.RUNNING || !run.receiptHash) {
    throw conflict(`Run ${runId} is not finalized; nothing to verify`);
  }

  const events = await prisma.event.findMany({ where: { runId }, orderBy: { seqNo: "asc" } });
  const approvals = await prisma.approval.findMany({ where: { runId } });
  const riskFlags = await prisma.riskFlag.findMany({ where: { runId } });

  const { receipt } = buildReceipt(
    { run, agent: run.agent, policy: run.policy, events, approvals, riskFlags },
    privateKeyHex,
    publicKeyHex,
  );

  const recomputedHash = hashCanonical(receipt.body);
  const sealedHash = run.receiptHash;
  const hashValid = recomputedHash === sealedHash;
  const signatureValid = run.receiptSignature
    ? verifySignature(sealedHash, run.receiptSignature, publicKeyHex)
    : false;

  return {
    runId,
    sealedHash,
    recomputedHash,
    hashValid,
    signatureValid,
    valid: hashValid && signatureValid,
  };
}

/**
 * Export the complete evidence bundle for a run: the full provenance trail
 * (events, approvals, artifacts, attestations, risk flags) plus the signed
 * receipt and its verification result for finalized runs. Self-contained and
 * independently verifiable.
 */
export async function exportRunEvidence(runId: string): Promise<{
  exportedAt: string;
  run: Awaited<ReturnType<typeof getRunDetail>>;
  receipt: Receipt | null;
  verification: RunVerification | null;
}> {
  const run = await getRunDetail(runId);
  let receipt: Receipt | null = null;
  let verification: RunVerification | null = null;
  if (run.status !== RunStatus.RUNNING && run.receiptHash) {
    receipt = await getReceipt(runId);
    verification = await getRunVerification(runId);
  }
  return { exportedAt: new Date().toISOString(), run, receipt, verification };
}
