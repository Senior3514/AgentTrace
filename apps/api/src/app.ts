import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
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

  await app.register(cors, { origin: true });

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

  app.get("/health", async () => ({ status: "ok", service: "agenttrace-api" }));

  await app.register(
    async (v1) => {
      await v1.register(readRoutes);
      await v1.register(writeRoutes);
    },
    { prefix: "/v1" },
  );

  return app;
}
