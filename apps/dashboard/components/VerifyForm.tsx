"use client";

import { useFormState, useFormStatus } from "react-dom";
import { verifyReceiptAction, type VerifyState } from "../app/verify/actions";
import { shortHash } from "../lib/format";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-verified px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Verifying…" : "Verify receipt"}
    </button>
  );
}

function Check({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-border py-2 first:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`mono text-sm ${value ? "text-verified" : "text-critical"}`}>
        {value ? "✓ pass" : "✗ fail"}
      </span>
    </div>
  );
}

export function VerifyForm() {
  const [state, formAction] = useFormState<VerifyState | null, FormData>(verifyReceiptAction, null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form action={formAction} className="panel p-4">
        <label htmlFor="receipt" className="stat-label">
          Receipt JSON
        </label>
        <textarea
          id="receipt"
          name="receipt"
          rows={16}
          spellCheck={false}
          placeholder='{"receiptVersion":"agenttrace.receipt.v1","body":{…},"runHash":"…","signature":"…","signedBy":"…"}'
          className="mono mt-2 w-full resize-y rounded border border-border bg-bg px-3 py-2 text-xs leading-relaxed text-text placeholder:text-muted focus:border-trace focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <SubmitButton />
          <span className="text-2xs text-muted">
            Verified locally on this server — no API, database, or private key.
          </span>
        </div>
      </form>

      <div className="panel p-4">
        <span className="stat-label">Result</span>
        {!state && (
          <p className="mt-3 text-sm text-muted">
            Paste a receipt (e.g. from <span className="mono">GET /v1/runs/&lt;id&gt;/receipt</span>)
            and verify its integrity and signature.
          </p>
        )}
        {state && !state.ok && (
          <p className="mt-3 text-sm text-critical">{state.error}</p>
        )}
        {state?.ok && state.result && (
          <div className="mt-3">
            <div
              className={`mb-3 rounded border px-3 py-2 text-sm font-medium ${
                state.result.valid
                  ? "border-verified/40 bg-verified/10 text-verified"
                  : "border-critical/40 bg-critical/10 text-critical"
              }`}
            >
              {state.result.valid ? "RECEIPT VALID" : "RECEIPT INVALID"}
            </div>
            <Check label="Hash integrity" value={state.result.hashValid} />
            <Check label="Ed25519 signature" value={state.result.signatureValid} />
            <Check label="Version supported" value={state.result.versionSupported} />
            <div className="mt-3 space-y-1 text-2xs text-muted">
              <div>
                version <span className="mono text-text">{state.result.receiptVersion}</span>
              </div>
              <div>
                runHash <span className="mono text-text">{shortHash(state.result.runHash, 20)}</span>
              </div>
              <div>
                signedBy <span className="mono text-text">{shortHash(state.result.signedBy, 20)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
