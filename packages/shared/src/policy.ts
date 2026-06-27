import { z } from "zod";
import { ActionClass, RiskFlagType, RiskSeverity } from "./enums.js";
import type { ComputedRiskFlag, RiskEventInput } from "./risk.js";

// Deterministic, structured policy rules. This is intentionally NOT a policy
// authoring system - it is a small, fixed rule set evaluated at finalize so
// actions can be bound to an explicit policy decision. No DSL, no scripting.

const actionClassEnum = z.enum(Object.values(ActionClass) as [string, ...string[]]);

export const policyRulesSchema = z
  .object({
    // Any event in one of these action classes is a hard violation.
    denyActionClasses: z.array(actionClassEnum).default([]),
    // Mutating events in these action classes require a recorded approval.
    requireApprovalFor: z.array(actionClassEnum).default([]),
    // When true, any irreversible event is a violation unless approved.
    forbidIrreversibleWithoutApproval: z.boolean().default(false),
  })
  .default({});

export type PolicyRules = z.infer<typeof policyRulesSchema>;

/**
 * Evaluate structured policy rules against a run's events. Pure and
 * deterministic: same rules + events always yield the same violations in the
 * same order. Violations are returned as risk flags of type `policy_violation`.
 */
export function evaluatePolicy(
  rules: PolicyRules,
  events: RiskEventInput[],
): ComputedRiskFlag[] {
  const flags: ComputedRiskFlag[] = [];
  const ordered = [...events].sort((a, b) => a.seqNo - b.seqNo);
  const deny = new Set(rules.denyActionClasses);
  const requireApproval = new Set(rules.requireApprovalFor);

  for (const ev of ordered) {
    if (deny.has(ev.actionClass)) {
      flags.push({
        flagType: RiskFlagType.POLICY_VIOLATION,
        severity: RiskSeverity.CRITICAL,
        title: "Policy violation: denied action",
        description: `Event #${ev.seqNo} (${ev.eventType}) performs a ${ev.actionClass} action, which the bound policy denies.`,
        eventSeqNo: ev.seqNo,
      });
      continue;
    }

    if (requireApproval.has(ev.actionClass) && ev.mutatesState && !ev.hasApproval) {
      flags.push({
        flagType: RiskFlagType.POLICY_VIOLATION,
        severity: RiskSeverity.HIGH,
        title: "Policy violation: approval required",
        description: `Event #${ev.seqNo} (${ev.eventType}) is a ${ev.actionClass} action that the bound policy requires an approval for, but none was recorded.`,
        eventSeqNo: ev.seqNo,
      });
    }

    if (rules.forbidIrreversibleWithoutApproval && ev.irreversible && !ev.hasApproval) {
      flags.push({
        flagType: RiskFlagType.POLICY_VIOLATION,
        severity: RiskSeverity.CRITICAL,
        title: "Policy violation: unapproved irreversible action",
        description: `Event #${ev.seqNo} (${ev.eventType}) is irreversible and was not approved, which the bound policy forbids.`,
        eventSeqNo: ev.seqNo,
      });
    }
  }

  return flags;
}
