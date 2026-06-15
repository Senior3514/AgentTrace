import type { ActionClass, ApprovalDecision, RiskLevel, RiskSeverity } from "./enums.js";
import { hashCanonical } from "./hashing.js";
import { verifySignature } from "./ed25519.js";

// Canonical receipt format. The `body` is what gets hashed and signed; the
// envelope adds the signature and non-hashed metadata. Keeping the body free
// of volatile fields (e.g. generation time) is what makes receipts
// independently verifiable.

export const RECEIPT_VERSION = "agenttrace.receipt.v1" as const;
export const HASH_ALGORITHM = "sha256" as const;
export const SIGNATURE_ALGORITHM = "ed25519" as const;

export interface ReceiptEventEntry {
  seqNo: number;
  eventType: string;
  timestamp: string;
  actorType: string;
  actionClass: ActionClass;
  toolName: string | null;
  targetSystem: string | null;
  mutatesState: boolean;
  irreversible: boolean;
  inputHash: string | null;
  outputHash: string | null;
  prevEventHash: string | null;
  eventHash: string;
}

export interface ReceiptApprovalEntry {
  eventSeqNo: number | null;
  approverType: string;
  approverId: string;
  decision: ApprovalDecision;
  approvedAt: string;
}

export interface ReceiptRiskFlagEntry {
  flagType: string;
  severity: RiskSeverity;
  eventSeqNo: number | null;
  title: string;
}

export interface ReceiptBody {
  version: typeof RECEIPT_VERSION;
  hashAlgorithm: typeof HASH_ALGORITHM;
  signatureAlgorithm: typeof SIGNATURE_ALGORITHM;
  run: {
    id: string;
    agentExternalId: string;
    runExternalId: string | null;
    parentRunId: string | null;
    status: string;
    riskLevel: RiskLevel;
    startedAt: string;
    endedAt: string | null;
  };
  agent: {
    externalId: string;
    name: string;
    environment: string;
  };
  policy: {
    name: string;
    version: string;
    policyHash: string;
  } | null;
  eventCount: number;
  events: ReceiptEventEntry[];
  approvals: ReceiptApprovalEntry[];
  riskFlags: ReceiptRiskFlagEntry[];
}

export interface Receipt {
  body: ReceiptBody;
  runHash: string;
  signature: string;
  signedBy: string;
  generatedAt: string;
}

export interface ReceiptVerification {
  hashValid: boolean;
  signatureValid: boolean;
  valid: boolean;
}

/**
 * Independently verify a receipt: recompute the run hash from the body and
 * check the Ed25519 signature against the embedded public key. Requires no
 * server, no private key, and no database — only the receipt itself.
 */
export function verifyReceipt(receipt: Receipt): ReceiptVerification {
  const hashValid = hashCanonical(receipt.body) === receipt.runHash;
  const signatureValid = verifySignature(
    receipt.runHash,
    receipt.signature,
    receipt.signedBy,
  );
  return { hashValid, signatureValid, valid: hashValid && signatureValid };
}
