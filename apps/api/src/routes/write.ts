import {
  createAgentSchema,
  createApprovalSchema,
  createArtifactSchema,
  createAttestationSchema,
  createEventSchema,
  createOwnerSchema,
  createPolicySchema,
  createRunSchema,
  finalizeRunSchema,
} from "@agenttrace/shared";
import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../plugins/api-key.js";
import { parse } from "../lib/validate.js";
import {
  createAgent,
  createApproval,
  createArtifact,
  createAttestation,
  createOwner,
  createPolicy,
} from "../services/entities.js";
import { createRun } from "../services/runs.js";
import { appendEvent } from "../services/events.js";
import { finalizeRun } from "../services/finalize.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/api-keys.js";
import { resetDemoData } from "../services/demo.js";
import { config } from "../config.js";
import { notFound } from "../lib/errors.js";
import { z } from "zod";

const createApiKeySchema = z.object({ name: z.string().min(1).max(120) });

/** All state-mutating endpoints. API key required. */
export async function writeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireApiKey);

  // DEMO_MODE only: wipe and re-seed the demo dataset. Guarded so it can never
  // run against a real (non-demo) database.
  app.post("/demo/reset", async (_req, reply) => {
    if (!config.demoMode) {
      throw notFound("Demo reset is only available when DEMO_MODE=true");
    }
    const summary = await resetDemoData();
    return reply.code(200).send(summary);
  });

  app.post("/owners", async (req, reply) => {
    const owner = await createOwner(parse(createOwnerSchema, req.body));
    return reply.code(201).send(owner);
  });

  app.post("/agents", async (req, reply) => {
    const agent = await createAgent(parse(createAgentSchema, req.body));
    return reply.code(201).send(agent);
  });

  app.post("/policies", async (req, reply) => {
    const policy = await createPolicy(parse(createPolicySchema, req.body));
    return reply.code(201).send(policy);
  });

  app.post("/runs", async (req, reply) => {
    const run = await createRun(parse(createRunSchema, req.body));
    return reply.code(201).send(run);
  });

  app.post("/events", async (req, reply) => {
    const event = await appendEvent(parse(createEventSchema, req.body));
    return reply.code(201).send(event);
  });

  app.post("/approvals", async (req, reply) => {
    const approval = await createApproval(parse(createApprovalSchema, req.body));
    return reply.code(201).send(approval);
  });

  app.post("/artifacts", async (req, reply) => {
    const artifact = await createArtifact(parse(createArtifactSchema, req.body));
    return reply.code(201).send(artifact);
  });

  app.post("/attestations", async (req, reply) => {
    const attestation = await createAttestation(parse(createAttestationSchema, req.body));
    return reply.code(201).send(attestation);
  });

  app.post<{ Params: { id: string } }>("/runs/:id/finalize", async (req, reply) => {
    const input = parse(finalizeRunSchema, req.body ?? {});
    const result = await finalizeRun(req.params.id, input);
    return reply.code(200).send(result);
  });

  // Mint a per-owner API key. Plaintext is returned exactly once.
  app.post<{ Params: { id: string } }>("/owners/:id/api-keys", async (req, reply) => {
    const { name } = parse(createApiKeySchema, req.body ?? {});
    const key = await createApiKey(req.params.id, name);
    return reply.code(201).send(key);
  });

  // List an owner's keys (metadata only; auth required). Usage audit via lastUsedAt.
  app.get<{ Params: { id: string } }>("/owners/:id/api-keys", async (req) => {
    return listApiKeys(req.params.id);
  });

  app.delete<{ Params: { id: string; keyId: string } }>(
    "/owners/:id/api-keys/:keyId",
    async (req, reply) => {
      const result = await revokeApiKey(req.params.id, req.params.keyId);
      return reply.code(200).send(result);
    },
  );
}
