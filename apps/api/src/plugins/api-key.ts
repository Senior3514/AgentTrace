import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { unauthorized } from "../lib/errors.js";
import { resolveApiKey } from "../services/api-keys.js";

function matchesAnyKey(provided: string, keys: string[]): boolean {
  const providedBuf = Buffer.from(provided);
  return keys.some((key) => {
    const keyBuf = Buffer.from(key);
    return keyBuf.length === providedBuf.length && timingSafeEqual(keyBuf, providedBuf);
  });
}

function extractKey(request: FastifyRequest): string | undefined {
  const header = request.headers["authorization"];
  const bearer =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : undefined;
  const xApiKey = request.headers["x-api-key"];
  return bearer ?? (typeof xApiKey === "string" ? xApiKey.trim() : undefined);
}

/**
 * Pre-handler enforcing API key auth on write routes.
 *
 * Two kinds of key are accepted:
 *  - a configured global key (API_KEYS) — admin/bootstrap, not tenant-scoped
 *  - a per-owner key minted via POST /v1/owners/:id/api-keys — sets request.ownerId
 *
 * Bearer or x-api-key header. Global comparison is constant-time.
 */
export async function requireApiKey(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const provided = extractKey(request);
  if (!provided) {
    throw unauthorized("Missing API key. Provide Authorization: Bearer <key>.");
  }

  // 1) Global admin key.
  if (config.apiKeys.length > 0 && matchesAnyKey(provided, config.apiKeys)) {
    request.authScope = "global";
    return;
  }

  // 2) Per-owner key (DB-backed).
  const resolved = await resolveApiKey(provided);
  if (resolved) {
    request.ownerId = resolved.ownerId;
    request.apiKeyId = resolved.keyId;
    request.authScope = "owner";
    return;
  }

  throw unauthorized("Invalid API key.");
}
