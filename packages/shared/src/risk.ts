import { ActionClass, RiskFlagType, RiskLevel, RiskSeverity } from "./enums.js";

// Minimal shapes the risk engine needs. Kept structural so they line up with
// both Prisma rows and SDK payloads without a hard dependency on either.
export interface RiskEventInput {
  seqNo: number;
  eventType: string;
  actionClass: ActionClass;
  toolName?: string | null;
  targetSystem?: string | null;
  mutatesState: boolean;
  irreversible: boolean;
  metadataJson?: Record<string, unknown> | null;
  hasApproval: boolean;
}

export interface RiskContextInput {
  hasPolicy: boolean;
  events: RiskEventInput[];
}

export interface ComputedRiskFlag {
  flagType: RiskFlagType;
  severity: RiskSeverity;
  title: string;
  description: string;
  /** seqNo of the event that triggered the flag, or null for run-level flags. */
  eventSeqNo: number | null;
}

export interface RiskAssessment {
  flags: ComputedRiskFlag[];
  riskLevel: RiskLevel;
}

const SEVERITY_ORDER: RiskSeverity[] = [
  RiskSeverity.INFO,
  RiskSeverity.LOW,
  RiskSeverity.MEDIUM,
  RiskSeverity.HIGH,
  RiskSeverity.CRITICAL,
];

const SEVERITY_TO_LEVEL: Record<RiskSeverity, RiskLevel> = {
  [RiskSeverity.INFO]: RiskLevel.NONE,
  [RiskSeverity.LOW]: RiskLevel.LOW,
  [RiskSeverity.MEDIUM]: RiskLevel.MEDIUM,
  [RiskSeverity.HIGH]: RiskLevel.HIGH,
  [RiskSeverity.CRITICAL]: RiskLevel.CRITICAL,
};

function isExternalTarget(ev: RiskEventInput): boolean {
  const t = (ev.targetSystem ?? "").toLowerCase();
  if (!t) return false;
  const internalMarkers = ["local", "localhost", "internal", "sandbox", "memory"];
  return !internalMarkers.some((m) => t.includes(m));
}

/**
 * Deterministic v0 risk evaluation.
 *
 * Pure function of the run context — no randomness, no ML, no clock reads.
 * Re-running with the same input always yields the same flags in the same
 * order, which is a precondition for reproducible receipts.
 */
export function assessRisk(ctx: RiskContextInput): RiskAssessment {
  const flags: ComputedRiskFlag[] = [];

  // Run-level: policy missing.
  if (!ctx.hasPolicy) {
    flags.push({
      flagType: RiskFlagType.POLICY_MISSING,
      severity: RiskSeverity.MEDIUM,
      title: "No policy bound to run",
      description:
        "This run executed without a bound policy, so actions could not be evaluated against approval rules.",
      eventSeqNo: null,
    });
  }

  const ordered = [...ctx.events].sort((a, b) => a.seqNo - b.seqNo);

  for (const ev of ordered) {
    const writesExternally =
      ev.actionClass === ActionClass.EXTERNAL_CALL ||
      (ev.mutatesState && isExternalTarget(ev));

    if (writesExternally && ev.mutatesState) {
      flags.push({
        flagType: RiskFlagType.EXTERNAL_WRITE,
        severity: RiskSeverity.HIGH,
        title: "External state mutation",
        description: `Event #${ev.seqNo} (${ev.eventType}) mutated an external system${
          ev.targetSystem ? ` (${ev.targetSystem})` : ""
        }.`,
        eventSeqNo: ev.seqNo,
      });
    }

    if (ev.actionClass === ActionClass.SECRET_ACCESS) {
      flags.push({
        flagType: RiskFlagType.SECRET_ACCESS,
        severity: RiskSeverity.HIGH,
        title: "Secret access",
        description: `Event #${ev.seqNo} accessed secret material${
          ev.toolName ? ` via ${ev.toolName}` : ""
        }.`,
        eventSeqNo: ev.seqNo,
      });
    }

    if (ev.actionClass === ActionClass.CODE_EXECUTION) {
      flags.push({
        flagType: RiskFlagType.CODE_EXECUTION,
        severity: RiskSeverity.MEDIUM,
        title: "Code execution",
        description: `Event #${ev.seqNo} executed code${
          ev.toolName ? ` via ${ev.toolName}` : ""
        }.`,
        eventSeqNo: ev.seqNo,
      });
    }

    if (ev.irreversible) {
      flags.push({
        flagType: RiskFlagType.IRREVERSIBLE_ACTION,
        severity: RiskSeverity.HIGH,
        title: "Irreversible action",
        description: `Event #${ev.seqNo} (${ev.eventType}) was marked irreversible.`,
        eventSeqNo: ev.seqNo,
      });

      const rollbackAvailable =
        ev.metadataJson?.["rollbackAvailable"] === true ||
        ev.metadataJson?.["rollback"] === true;
      if (!rollbackAvailable) {
        flags.push({
          flagType: RiskFlagType.ROLLBACK_UNAVAILABLE,
          severity: RiskSeverity.MEDIUM,
          title: "Rollback unavailable",
          description: `Event #${ev.seqNo} is irreversible and declared no rollback path.`,
          eventSeqNo: ev.seqNo,
        });
      }
    }

    // High-impact actions without an approval.
    const requiresApproval =
      ev.mutatesState &&
      (ev.irreversible ||
        ev.actionClass === ActionClass.EXTERNAL_CALL ||
        ev.actionClass === ActionClass.SECRET_ACCESS);
    if (requiresApproval && !ev.hasApproval) {
      flags.push({
        flagType: RiskFlagType.APPROVAL_MISSING,
        severity: RiskSeverity.HIGH,
        title: "Approval missing",
        description: `Event #${ev.seqNo} (${ev.eventType}) performed a high-impact action without a recorded approval.`,
        eventSeqNo: ev.seqNo,
      });
    }

    // Ambiguous target: mutating action with no resolvable target.
    if (ev.mutatesState && !ev.targetSystem) {
      flags.push({
        flagType: RiskFlagType.AMBIGUOUS_TARGET,
        severity: RiskSeverity.LOW,
        title: "Ambiguous target",
        description: `Event #${ev.seqNo} mutated state but did not declare a target system.`,
        eventSeqNo: ev.seqNo,
      });
    }
  }

  return { flags, riskLevel: rollupRiskLevel(flags) };
}

function rollupRiskLevel(flags: ComputedRiskFlag[]): RiskLevel {
  if (flags.length === 0) return RiskLevel.NONE;
  let maxIdx = 0;
  for (const f of flags) {
    const idx = SEVERITY_ORDER.indexOf(f.severity);
    if (idx > maxIdx) maxIdx = idx;
  }
  const severity = SEVERITY_ORDER[maxIdx]!;
  return SEVERITY_TO_LEVEL[severity];
}
