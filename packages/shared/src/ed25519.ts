import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

// Ed25519 primitives shared by the API (signing) and SDK (verification).
//
// Keys travel as raw 32-byte hex strings — a seed for the private key and raw
// public key bytes for verification — which are easy to store in env vars. We
// wrap them in the DER structures Node's crypto expects.

const PRIV_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex"); // PKCS8 header
const PUB_PREFIX = Buffer.from("302a300506032b6570032100", "hex"); // SPKI header

export interface KeyPairHex {
  privateKeyHex: string;
  publicKeyHex: string;
}

export function generateKeyPair(): KeyPairHex {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { privateKeyHex: rawPrivateHex(privateKey), publicKeyHex: rawPublicHex(publicKey) };
}

function rawPrivateHex(key: KeyObject): string {
  const der = key.export({ type: "pkcs8", format: "der" });
  return Buffer.from(der.subarray(der.length - 32)).toString("hex");
}

function rawPublicHex(key: KeyObject): string {
  const der = key.export({ type: "spki", format: "der" });
  return Buffer.from(der.subarray(der.length - 32)).toString("hex");
}

function privateKeyFromHex(seedHex: string): KeyObject {
  const seed = Buffer.from(seedHex, "hex");
  if (seed.length !== 32) {
    throw new Error("Ed25519 private seed must be 32 bytes (64 hex chars)");
  }
  return createPrivateKey({ key: Buffer.concat([PRIV_PREFIX, seed]), format: "der", type: "pkcs8" });
}

function publicKeyFromHex(pubHex: string): KeyObject {
  const pub = Buffer.from(pubHex, "hex");
  if (pub.length !== 32) {
    throw new Error("Ed25519 public key must be 32 bytes (64 hex chars)");
  }
  return createPublicKey({ key: Buffer.concat([PUB_PREFIX, pub]), format: "der", type: "spki" });
}

/** Derive the public key hex from a private seed. */
export function publicFromPrivate(seedHex: string): string {
  return rawPublicHex(createPublicKey(privateKeyFromHex(seedHex)));
}

/** Sign a UTF-8 message, returning a hex signature. */
export function signMessage(message: string, seedHex: string): string {
  return nodeSign(null, Buffer.from(message, "utf8"), privateKeyFromHex(seedHex)).toString("hex");
}

/** Verify a hex signature against a UTF-8 message and public key hex. */
export function verifySignature(
  message: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  try {
    return nodeVerify(
      null,
      Buffer.from(message, "utf8"),
      publicKeyFromHex(publicKeyHex),
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}
