// Generate an Ed25519 keypair for signing receipts.
// Usage: pnpm keys:generate
import { generateKeyPair } from "../packages/shared/src/ed25519.js";

const { privateKeyHex, publicKeyHex } = generateKeyPair();

console.log("# Add these to your .env file:\n");
console.log(`RECEIPT_SIGNING_KEY="${privateKeyHex}"`);
console.log(`RECEIPT_PUBLIC_KEY="${publicKeyHex}"`);
