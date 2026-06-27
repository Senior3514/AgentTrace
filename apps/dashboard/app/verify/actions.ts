"use server";

import { verifyReceipt, type Receipt } from "@agenttrace/shared";

export interface VerifyState {
  ok: boolean;
  error?: string;
  result?: {
    receiptVersion: string;
    runHash: string;
    signedBy: string;
    hashValid: boolean;
    signatureValid: boolean;
    versionSupported: boolean;
    valid: boolean;
  };
}

/**
 * Verify a pasted receipt entirely on the dashboard's own server using the
 * shared Ed25519/SHA-256 primitives - no AgentTrace API, database, or private
 * key involved. This is the "verify anywhere" property made interactive.
 */
export async function verifyReceiptAction(
  _prev: VerifyState | null,
  formData: FormData,
): Promise<VerifyState> {
  const raw = String(formData.get("receipt") ?? "").trim();
  if (!raw) return { ok: false, error: "Paste a receipt JSON to verify." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That isn't valid JSON." };
  }

  const r = parsed as Partial<Receipt> | null;
  if (!r || typeof r !== "object" || !r.body || !r.runHash || !r.signature || !r.signedBy) {
    return {
      ok: false,
      error: "Not a receipt - expected fields: body, runHash, signature, signedBy.",
    };
  }

  try {
    const v = verifyReceipt(r as Receipt);
    return {
      ok: true,
      result: {
        receiptVersion: (r as Receipt).receiptVersion ?? r.body.version ?? "unknown",
        runHash: r.runHash,
        signedBy: r.signedBy,
        ...v,
      },
    };
  } catch (err) {
    return { ok: false, error: `Could not verify: ${(err as Error).message}` };
  }
}
