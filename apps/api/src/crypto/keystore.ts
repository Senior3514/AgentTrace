import { config } from "../config.js";
import { generateKeyPair, publicFromPrivate } from "./signing.js";

// Resolve the receipt signing key once at startup. In production a key MUST be
// provided via RECEIPT_SIGNING_KEY; for local dev we generate an ephemeral key
// and warn loudly, since ephemeral keys make receipts unverifiable across
// restarts.

let cached: { privateKeyHex: string; publicKeyHex: string } | undefined;

export function getKeystore(): { privateKeyHex: string; publicKeyHex: string } {
  if (cached) return cached;

  if (config.signingKey) {
    cached = {
      privateKeyHex: config.signingKey,
      publicKeyHex: config.publicKey ?? publicFromPrivate(config.signingKey),
    };
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RECEIPT_SIGNING_KEY is required in production. Generate one with `pnpm keys:generate`.",
    );
  }

  const pair = generateKeyPair();
  // eslint-disable-next-line no-console
  console.warn(
    "[agenttrace] RECEIPT_SIGNING_KEY not set — using an EPHEMERAL signing key. " +
      "Receipts will not verify across restarts. Run `pnpm keys:generate` for a stable key.",
  );
  cached = { privateKeyHex: pair.privateKeyHex, publicKeyHex: pair.publicKeyHex };
  return cached;
}
