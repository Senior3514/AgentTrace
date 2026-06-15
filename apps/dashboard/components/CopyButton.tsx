"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="rounded border border-border bg-surface-2 px-2 py-1 text-2xs uppercase tracking-wide text-muted transition-colors hover:text-text hover:border-trace"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
