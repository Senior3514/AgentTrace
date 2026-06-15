import type {
  CreateAgentInput,
  CreateApprovalInput,
  CreateArtifactInput,
  CreateAttestationInput,
  CreateOwnerInput,
  CreatePolicyInput,
} from "@agenttrace/shared";
import { hashCanonical } from "@agenttrace/shared";
import { prisma } from "../db.js";
import { getKeystore } from "../crypto/keystore.js";
import { signMessage } from "../crypto/signing.js";
import { badRequest, notFound } from "../lib/errors.js";

export async function createOwner(input: CreateOwnerInput) {
  return prisma.owner.create({
    data: {
      type: input.type as never,
      name: input.name,
      externalRef: input.externalRef ?? null,
    },
  });
}

export async function createAgent(input: CreateAgentInput) {
  const owner = await prisma.owner.findUnique({ where: { id: input.ownerId } });
  if (!owner) throw notFound(`Owner ${input.ownerId} not found`);

  const existing = await prisma.agent.findUnique({
    where: { externalId: input.externalId },
  });
  if (existing) throw badRequest(`Agent externalId '${input.externalId}' already exists`);

  return prisma.agent.create({
    data: {
      externalId: input.externalId,
      name: input.name,
      ownerId: input.ownerId,
      environment: input.environment,
      framework: input.framework ?? null,
      metadataJson: input.metadataJson as never,
    },
  });
}

export async function createPolicy(input: CreatePolicyInput) {
  const owner = await prisma.owner.findUnique({ where: { id: input.ownerId } });
  if (!owner) throw notFound(`Owner ${input.ownerId} not found`);

  // Policy hash binds the exact text + version, so receipts can prove which
  // policy an action was evaluated against.
  const policyHash = hashCanonical({
    name: input.name,
    version: input.version,
    policyText: input.policyText,
  });

  return prisma.policy.create({
    data: {
      ownerId: input.ownerId,
      name: input.name,
      version: input.version,
      policyText: input.policyText,
      policyHash,
    },
  });
}

export async function createApproval(input: CreateApprovalInput) {
  const run = await prisma.run.findUnique({ where: { id: input.runId } });
  if (!run) throw notFound(`Run ${input.runId} not found`);
  if (input.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: input.eventId, runId: input.runId },
    });
    if (!event) throw badRequest(`Event ${input.eventId} does not belong to run ${input.runId}`);
  }

  return prisma.approval.create({
    data: {
      runId: input.runId,
      eventId: input.eventId ?? null,
      approverType: input.approverType as never,
      approverId: input.approverId,
      decision: input.decision as never,
      reason: input.reason ?? null,
      approvedAt: input.approvedAt ?? new Date(),
    },
  });
}

export async function createArtifact(input: CreateArtifactInput) {
  const run = await prisma.run.findUnique({ where: { id: input.runId } });
  if (!run) throw notFound(`Run ${input.runId} not found`);

  return prisma.artifact.create({
    data: {
      runId: input.runId,
      eventId: input.eventId ?? null,
      artifactType: input.artifactType as never,
      uri: input.uri,
      sha256: input.sha256,
      contentPreview: input.contentPreview ?? null,
    },
  });
}

/**
 * Attestations are signed statements about a run. We sign the canonical
 * statement payload with the same Ed25519 key used for receipts.
 */
export async function createAttestation(input: CreateAttestationInput) {
  const run = await prisma.run.findUnique({ where: { id: input.runId } });
  if (!run) throw notFound(`Run ${input.runId} not found`);

  const { privateKeyHex, publicKeyHex } = getKeystore();
  const payload = hashCanonical({
    runId: input.runId,
    attestationType: input.attestationType,
    subject: input.subject,
    statement: input.statement,
    evidenceRef: input.evidenceRef ?? null,
  });
  const signature = signMessage(payload, privateKeyHex);

  return prisma.attestation.create({
    data: {
      runId: input.runId,
      attestationType: input.attestationType as never,
      subject: input.subject,
      statement: input.statement,
      evidenceRef: input.evidenceRef ?? null,
      signedBy: publicKeyHex,
      signature,
    },
  });
}
