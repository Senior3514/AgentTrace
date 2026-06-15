import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { unauthorized } from "../lib/errors.js";

function matchesAnyKey(provided: string, keys: string[]): boolean {
  const providedBuf = Buffer.from(provided);
  return keys.some((key) => {
    const keyBuf = Buffer.from(key);
    return (
      keyBuf.length === providedBuf.length &&
      timingSafeEqual(keyBuf, providedBuf)
    );
  });
}

/**
 * Pre-handler enforcing API key auth on write routes.
 *
 * Accepts either `Authorization: Bearer <key>` or `x-api-key: <key>`.
 * Comparison is constant-time to avoid leaking key material via timing.
 */
export async function requireApiKey(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers["authorization"];
  const bearer =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : undefined;
  const xApiKey = request.headers["x-api-key"];
  const provided = bearer ?? (typeof xApiKey === "string" ? xApiKey.trim() : undefined);

  if (!provided) {
    throw unauthorized("Missing API key. Provide Authorization: Bearer <key>.");
  }
  if (config.apiKeys.length === 0) {
    throw unauthorized("Server has no API keys configured.");
  }
  if (!matchesAnyKey(provided, config.apiKeys)) {
    throw unauthorized("Invalid API key.");
  }
}
