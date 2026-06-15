import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

// Vercel serverless entry for the AgentTrace API.
//
// Fastify is built once per warm instance and reused across invocations. We
// hand the raw Node request/response to Fastify's underlying server so all
// existing routes, plugins, and the error handler work unchanged.

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
