import { listQuerySchema } from "@agenttrace/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { notFound } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { getRunDetail, listRuns } from "../services/runs.js";
import { getReceipt } from "../services/finalize.js";

/** Read-only query endpoints. No API key required. */
export async function readRoutes(app: FastifyInstance): Promise<void> {
  app.get("/agents", async (req) => {
    const q = parse(listQuerySchema, req.query);
    const [items, total] = await Promise.all([
      prisma.agent.findMany({
        orderBy: { createdAt: "desc" },
        take: q.limit,
        skip: q.offset,
        include: {
          owner: { select: { id: true, name: true, type: true } },
          _count: { select: { runs: true } },
        },
      }),
      prisma.agent.count(),
    ]);
    return { items, total, limit: q.limit, offset: q.offset };
  });

  app.get<{ Params: { id: string } }>("/agents/:id", async (req) => {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        owner: true,
        _count: { select: { runs: true } },
      },
    });
    if (!agent) throw notFound(`Agent ${req.params.id} not found`);
    return agent;
  });

  app.get<{ Params: { id: string } }>("/agents/:id/runs", async (req) => {
    const q = parse(listQuerySchema, req.query);
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) throw notFound(`Agent ${req.params.id} not found`);
    return listRuns({ ...q, agentId: req.params.id });
  });

  app.get("/runs", async (req) => {
    const q = parse(listQuerySchema, req.query);
    return listRuns(q);
  });

  app.get<{ Params: { id: string } }>("/runs/:id", async (req) => {
    return getRunDetail(req.params.id);
  });

  app.get<{ Params: { id: string } }>("/runs/:id/receipt", async (req) => {
    return getReceipt(req.params.id);
  });
}
