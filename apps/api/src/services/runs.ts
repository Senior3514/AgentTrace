import type { CreateRunInput, ListQuery } from "@agenttrace/shared";
import { RunStatus } from "@agenttrace/shared";
import { prisma } from "../db.js";
import { badRequest, notFound } from "../lib/errors.js";

export async function createRun(input: CreateRunInput) {
  const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
  if (!agent) throw notFound(`Agent ${input.agentId} not found`);

  if (input.policyId) {
    const policy = await prisma.policy.findUnique({ where: { id: input.policyId } });
    if (!policy) throw badRequest(`Policy ${input.policyId} not found`);
  }
  if (input.parentRunId) {
    const parent = await prisma.run.findUnique({ where: { id: input.parentRunId } });
    if (!parent) throw badRequest(`Parent run ${input.parentRunId} not found`);
  }

  return prisma.run.create({
    data: {
      agentId: input.agentId,
      runExternalId: input.runExternalId ?? null,
      parentRunId: input.parentRunId ?? null,
      policyId: input.policyId ?? null,
      startedAt: input.startedAt ?? new Date(),
      status: RunStatus.RUNNING as never,
    },
  });
}

export async function listRuns(query: ListQuery & { agentId?: string }) {
  const where = query.agentId ? { agentId: query.agentId } : {};
  const [items, total] = await Promise.all([
    prisma.run.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        agent: { select: { id: true, externalId: true, name: true } },
        _count: { select: { events: true, riskFlags: true, approvals: true } },
      },
    }),
    prisma.run.count({ where }),
  ]);
  return { items, total, limit: query.limit, offset: query.offset };
}

export async function getRunDetail(id: string) {
  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      agent: true,
      policy: true,
      events: { orderBy: { seqNo: "asc" } },
      approvals: { orderBy: { approvedAt: "asc" } },
      artifacts: { orderBy: { createdAt: "asc" } },
      attestations: { orderBy: { createdAt: "asc" } },
      riskFlags: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) throw notFound(`Run ${id} not found`);
  return run;
}
