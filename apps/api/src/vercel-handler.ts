import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.js";

// The real Vercel serverless handler. Bundled by `vercel-build.mjs` (esbuild)
// into api/_server.js so that the workspace package @agenttrace/shared (TS
// source) is inlined — Vercel's builder then never has to resolve TS sources or
// the package `exports` field. Fastify, Prisma, Zod, etc. stay external and are
// required normally from node_modules at runtime.

let ready: ReturnType<typeof boot> | null = null;

async function boot() {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!ready) ready = boot();
  const app = await ready;
  app.server.emit("request", req, res);
}
