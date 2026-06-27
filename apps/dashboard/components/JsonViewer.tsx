"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "./CopyButton";

// Lightweight syntax-highlighted JSON viewer. No external deps - we tokenize
// the pretty-printed string and color keys, strings, numbers and literals.
function highlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-trace"; // number
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "text-muted" : "text-verified";
        } else if (/true|false/.test(match)) {
          cls = "text-warning";
        } else if (/null/.test(match)) {
          cls = "text-critical";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

export function JsonViewer({
  data,
  title,
  collapsedHeight,
}: {
  data: unknown;
  title?: string;
  collapsedHeight?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const pretty = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const html = useMemo(() => highlight(pretty), [pretty]);
  const collapsible = collapsedHeight !== undefined;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="stat-label">{title ?? "JSON"}</span>
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-2xs uppercase tracking-wide text-muted hover:text-text"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          <CopyButton value={pretty} />
        </div>
      </div>
      <pre
        className="overflow-auto bg-bg px-3 py-3 mono leading-relaxed"
        style={
          collapsible && !expanded
            ? { maxHeight: collapsedHeight }
            : undefined
        }
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
