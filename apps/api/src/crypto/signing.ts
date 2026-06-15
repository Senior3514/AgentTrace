// Ed25519 primitives live in @agenttrace/shared so the SDK can verify receipts
// without depending on the API. Re-exported here for local import ergonomics.
export {
  generateKeyPair,
  publicFromPrivate,
  signMessage,
  verifySignature,
  type KeyPairHex,
} from "@agenttrace/shared";
