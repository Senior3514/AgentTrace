import { z } from "zod";
import { policyRulesSchema } from "./policy.js";
import {
  ActionClass,
  ActorType,
  ApprovalDecision,
  ApproverType,
  ArtifactType,
  AttestationType,
  OwnerType,
} from "./enums.js";

const enumOf = <T extends Record<string, string>>(e: T) =>
  z.enum(Object.values(e) as [string, ...string[]]);

const jsonObject = z.record(z.unknown()).default({});

export const createOwnerSchema = z.object({
  type: enumOf(OwnerType).default(OwnerType.ORG),
  name: z.string().min(1).max(200),
  externalRef: z.string().max(200).optional(),
});
export type CreateOwnerInput = z.infer<typeof createOwnerSchema>;

export const createAgentSchema = z.object({
  externalId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  ownerId: z.string().min(1),
  environment: z.string().min(1).max(80).default("production"),
  framework: z.string().max(120).optional(),
  metadataJson: jsonObject,
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const createPolicySchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(40).default("1"),
  policyText: z.string().min(1),
  rules: policyRulesSchema.optional(),
});
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const createRunSchema = z.object({
  agentId: z.string().min(1),
  runExternalId: z.string().max(200).optional(),
  parentRunId: z.string().optional(),
  policyId: z.string().optional(),
  startedAt: z.coerce.date().optional(),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

export const createEventSchema = z.object({
  runId: z.string().min(1),
  seqNo: z.number().int().nonnegative(),
  eventType: z.string().min(1).max(120),
  timestamp: z.coerce.date().optional(),
  actorType: enumOf(ActorType).default(ActorType.AGENT),
  actorId: z.string().max(200).optional(),
  toolName: z.string().max(200).optional(),
  targetSystem: z.string().max(200).optional(),
  actionClass: enumOf(ActionClass).default(ActionClass.OTHER),
  mutatesState: z.boolean().default(false),
  irreversible: z.boolean().default(false),
  inputHash: z.string().max(128).optional(),
  outputHash: z.string().max(128).optional(),
  metadataJson: jsonObject,
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const createApprovalSchema = z.object({
  runId: z.string().min(1),
  eventId: z.string().optional(),
  approverType: enumOf(ApproverType).default(ApproverType.HUMAN),
  approverId: z.string().min(1).max(200),
  decision: enumOf(ApprovalDecision),
  reason: z.string().max(2000).optional(),
  approvedAt: z.coerce.date().optional(),
});
export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;

export const createArtifactSchema = z.object({
  runId: z.string().min(1),
  eventId: z.string().optional(),
  artifactType: enumOf(ArtifactType).default(ArtifactType.OTHER),
  uri: z.string().min(1).max(2000),
  sha256: z.string().min(1).max(128),
  contentPreview: z.string().max(4000).optional(),
});
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

export const createAttestationSchema = z.object({
  runId: z.string().min(1),
  attestationType: enumOf(AttestationType).default(AttestationType.CUSTOM),
  subject: z.string().min(1).max(200),
  statement: z.string().min(1).max(4000),
  evidenceRef: z.string().max(2000).optional(),
});
export type CreateAttestationInput = z.infer<typeof createAttestationSchema>;

export const finalizeRunSchema = z
  .object({
    status: z.enum(["FINALIZED", "FAILED", "ABORTED"]).default("FINALIZED"),
    endedAt: z.coerce.date().optional(),
  })
  .default({ status: "FINALIZED" });
export type FinalizeRunInput = z.infer<typeof finalizeRunSchema>;

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
