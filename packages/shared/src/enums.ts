// Enum values mirrored from the Prisma schema. Kept as plain const objects so
// they can be shared by the API, SDK and dashboard without importing Prisma.

export const OwnerType = {
  ORG: "ORG",
  TEAM: "TEAM",
  USER: "USER",
  SERVICE: "SERVICE",
} as const;
export type OwnerType = (typeof OwnerType)[keyof typeof OwnerType];

export const RunStatus = {
  RUNNING: "RUNNING",
  FINALIZED: "FINALIZED",
  FAILED: "FAILED",
  ABORTED: "ABORTED",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const RiskLevel = {
  NONE: "NONE",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const ActorType = {
  AGENT: "AGENT",
  HUMAN: "HUMAN",
  SYSTEM: "SYSTEM",
  TOOL: "TOOL",
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const ActionClass = {
  READ: "READ",
  WRITE: "WRITE",
  EXTERNAL_CALL: "EXTERNAL_CALL",
  CODE_EXECUTION: "CODE_EXECUTION",
  SECRET_ACCESS: "SECRET_ACCESS",
  APPROVAL: "APPROVAL",
  CONTROL: "CONTROL",
  OTHER: "OTHER",
} as const;
export type ActionClass = (typeof ActionClass)[keyof typeof ActionClass];

export const ApprovalDecision = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ESCALATED: "ESCALATED",
  EXPIRED: "EXPIRED",
} as const;
export type ApprovalDecision =
  (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export const ApproverType = {
  HUMAN: "HUMAN",
  POLICY: "POLICY",
  SYSTEM: "SYSTEM",
} as const;
export type ApproverType = (typeof ApproverType)[keyof typeof ApproverType];

export const RiskSeverity = {
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type RiskSeverity = (typeof RiskSeverity)[keyof typeof RiskSeverity];

export const ArtifactType = {
  FILE: "FILE",
  DIFF: "DIFF",
  LOG: "LOG",
  OUTPUT: "OUTPUT",
  SCREENSHOT: "SCREENSHOT",
  DATASET: "DATASET",
  OTHER: "OTHER",
} as const;
export type ArtifactType = (typeof ArtifactType)[keyof typeof ArtifactType];

export const AttestationType = {
  RECEIPT: "RECEIPT",
  IDENTITY: "IDENTITY",
  POLICY_BINDING: "POLICY_BINDING",
  CUSTOM: "CUSTOM",
} as const;
export type AttestationType =
  (typeof AttestationType)[keyof typeof AttestationType];

// Deterministic v0 risk flag types.
export const RiskFlagType = {
  EXTERNAL_WRITE: "external_write",
  SECRET_ACCESS: "secret_access",
  CODE_EXECUTION: "code_execution",
  APPROVAL_MISSING: "approval_missing",
  IRREVERSIBLE_ACTION: "irreversible_action",
  POLICY_MISSING: "policy_missing",
  AMBIGUOUS_TARGET: "ambiguous_target",
  ROLLBACK_UNAVAILABLE: "rollback_unavailable",
} as const;
export type RiskFlagType = (typeof RiskFlagType)[keyof typeof RiskFlagType];
