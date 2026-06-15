"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_AGENTTRACE_API_URL ?? "http://localhost:4000";

/** Downloads the complete evidence bundle for a run as a JSON file. */
export function ExportButton({ runId }: { runId: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`${API_BASE}/v1/runs/${runId}/export`, { cache: "no-store" });
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `agenttrace-run-${runId}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        } finally {
          setBusy(false);
        }
      }}
      className="rounded border border-border px-3 py-1.5 text-sm text-text transition-colors hover:border-trace disabled:opacity-50"
    >
      {busy ? "Exporting…" : "Export evidence"}
    </button>
  );
}
