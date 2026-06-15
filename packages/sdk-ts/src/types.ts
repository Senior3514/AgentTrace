import type {
  ActionClass,
  ActorType,
  ApprovalDecision,
  ApproverType,
  AttestationType,
  OwnerType,
  Receipt,
} from "@agenttrace/shared";

export interface AgentTraceClientOptions {
  /** Base URL of the AgentTrace API, e.g. http://localhost:4000 */
  baseUrl: string;
  /** API key used for write endpoints. */
  apiKey: string;
  /** Optional custom fetch (defaults to global fetch). */
  fetch?: typeof fetch;
}

export interface Owner {
  id: string;
  type: OwnerType;
  name: string;
  externalRef: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  externalId: string;
  name: string;
  ownerId: string;
  environment: string;
  framework: string | null;
  createdAt: string;
}

export interface Policy {
  id: string;
  ownerId: string;
  name: string;
  version: string;
  policyHash: string;
  createdAt: string;
}

export interface Run {
  id: string;
  agentId: string;
  runExternalId: string | null;
  parentRunId: string | null;
  policyId: string | null;
  status: string;
  riskLevel: string | null;
  receiptHash: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface CreateOwnerArgs {
  type?: OwnerType;
  name: string;
  externalRef?: string;
}

export interface CreateAgentArgs {
  externalId: string;
  name: string;
  ownerId: string;
  environment?: string;
  framework?: string;
  metadataJson?: Record<string, unknown>;
}

export interface PolicyRulesInput {
  denyActionClasses?: ActionClass[];
  requireApprovalFor?: ActionClass[];
  forbidIrreversibleWithoutApproval?: boolean;
}

export interface CreatePolicyArgs {
  ownerId: string;
  name: string;
  version?: string;
  policyText: string;
  rules?: PolicyRulesInput;
}

export interface StartRunArgs {
  agentId: string;
  runExternalId?: string;
  parentRunId?: string;
  policyId?: string;
  startedAt?: Date | string;
}

export interface ReportEventArgs {
  runId: string;
  seqNo: number;
  eventType: string;
  timestamp?: Date | string;
  actorType?: ActorType;
  actorId?: string;
  toolName?: string;
  targetSystem?: string;
  actionClass?: ActionClass;
  mutatesState?: boolean;
  irreversible?: boolean;
  inputHash?: string;
  outputHash?: string;
  metadataJson?: Record<string, unknown>;
}

export interface ReportApprovalArgs {
  runId: string;
  eventId?: string;
  approverType?: ApproverType;
  approverId: string;
  decision: ApprovalDecision;
  reason?: string;
  approvedAt?: Date | string;
}

export interface ReportAttestationArgs {
  runId: string;
  attestationType?: AttestationType;
  subject: string;
  statement: string;
  evidenceRef?: string;
}

export interface FinalizeRunArgs {
  status?: "FINALIZED" | "FAILED" | "ABORTED";
  endedAt?: Date | string;
}

export type { Receipt };
