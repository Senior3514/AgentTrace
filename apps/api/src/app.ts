import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { AppError } from "./lib/errors.js";
import { readRoutes } from "./routes/read.js";
import { writeRoutes } from "./routes/write.js";

export interface BuildOptions {
  logger?: boolean;
}

/** Construct the Fastify app. Exported so tests can drive it via `inject`. */
export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    bodyLimit: 5 * 1024 * 1024,
  });

  // Security headers. Configured for a cross-origin JSON API: no CSP (we serve
  // no HTML) and a cross-origin resource policy so the dashboard — typically a
  // different origin — can still read responses. Keeps nosniff, frameguard,
  // HSTS, referrer-policy, etc.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // CORS: permissive by default; restrict to a fixed allow-list via CORS_ORIGINS.
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
  });
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
  });

  // Request-scoped auth context, populated by the API-key pre-handler.
  app.decorateRequest("ownerId", null);
  app.decorateRequest("apiKeyId", null);
  app.decorateRequest("authScope", null);

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "bad_request",
        message: "Validation failed",
        details: error.flatten(),
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "internal_error", message: "Internal server error" });
  });

  // Liveness + DB readiness. Always 200 when the function is alive — the `db`
  // field reports connectivity without failing, so a misconfigured/absent
  // DATABASE_URL is visible here instead of crashing the function.
  app.get("/health", async () => {
    let db: "up" | "down" = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return { status: "ok", service: "agenttrace-api", db };
  });

  await app.register(
    async (v1) => {
      await v1.register(readRoutes);
      await v1.register(writeRoutes);
    },
    { prefix: "/v1" },
  );

  return app;
}
