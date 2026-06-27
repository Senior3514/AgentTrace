import { prisma } from "../db.js";
import { generateApiKey, hashApiKey } from "../crypto/api-keys.js";
import { notFound } from "../lib/errors.js";

/** Mint a new API key for an owner. Returns the plaintext exactly once. */
export async function createApiKey(ownerId: string, name: string) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) throw notFound(`Owner ${ownerId} not found`);

  const { plaintext, prefix, keyHash } = generateApiKey();
  const record = await prisma.apiKey.create({
    data: { ownerId, name, prefix, keyHash },
  });

  return {
    id: record.id,
    ownerId,
    name: record.name,
    prefix: record.prefix,
    createdAt: record.createdAt,
    // Shown once - never retrievable again.
    key: plaintext,
  };
}

/** List an owner's keys (metadata only - never the secret). */
export async function listApiKeys(ownerId: string) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) throw notFound(`Owner ${ownerId} not found`);

  const keys = await prisma.apiKey.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return { items: keys, total: keys.length };
}

/** Revoke a key. Idempotent. */
export async function revokeApiKey(ownerId: string, keyId: string) {
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, ownerId } });
  if (!key) throw notFound(`API key ${keyId} not found for owner ${ownerId}`);
  if (!key.revokedAt) {
    await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  }
  return { id: keyId, revoked: true };
}

/**
 * Resolve a plaintext key to its owner, if valid and not revoked. Updates
 * `lastUsedAt` for a lightweight usage audit trail. Returns null on no match.
 */
export async function resolveApiKey(plaintext: string): Promise<{ ownerId: string; keyId: string } | null> {
  const keyHash = hashApiKey(plaintext);
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!key || key.revokedAt) return null;

  // Fire-and-forget usage timestamp; failure here must not block the request.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ownerId: key.ownerId, keyId: key.id };
}
