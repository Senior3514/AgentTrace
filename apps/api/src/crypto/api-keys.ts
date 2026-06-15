import { randomBytes } from "node:crypto";
import { sha256Hex } from "@agenttrace/shared";

// Per-owner API keys. The plaintext is shown to the caller exactly once at
// creation; only the SHA-256 hash is stored. A short non-secret prefix is kept
// for display/identification ("which key is this").

const KEY_PREFIX = "at_";

export interface GeneratedKey {
  plaintext: string;
  prefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedKey {
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, KEY_PREFIX.length + 6),
    keyHash: sha256Hex(plaintext),
  };
}

export function hashApiKey(plaintext: string): string {
  return sha256Hex(plaintext);
}
