"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RunRow } from "../lib/api";
import { RiskChip, StatusBadge } from "./badges";
import { formatDuration, formatRelative, shortHash } from "../lib/format";

const STATUSES = ["ALL", "RUNNING", "FINALIZED", "FAILED", "ABORTED"];
const RISKS = ["ALL", "NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

const RISK_ACCENT: Record<string, string> = {
  NONE: "transparent",
  LOW: "#3BA7FF",
  MEDIUM: "#F6B84C",
  HIGH: "#FF5C7A",
  CRITICAL: "#FF5C7A",
};

export function RunsTable({ runs }: { runs: RunRow[] }) {
  const [status, setStatus] = useState("ALL");
  const [risk, setRisk] = useState("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (risk !== "ALL" && (r.riskLevel ?? "NONE") !== risk) return false;
      if (q) {
        const hay = `${r.runExternalId ?? ""} ${r.id} ${r.agent?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [runs, status, risk, query]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search run id or agent…"
          className="w-64 rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-muted focus:border-trace focus:outline-none"
        />
        <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <Select label="Risk" value={risk} onChange={setRisk} options={RISKS} />
        <span className="ml-auto text-2xs uppercase tracking-wide text-muted">
          {filtered.length} / {runs.length}
        </span>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="border-b border-border bg-surface-2/40">
            <tr>
              <th className="th">Run</th>
              <th className="th">Agent</th>
              <th className="th">Status</th>
              <th className="th">Risk</th>
              <th className="th">Events</th>
              <th className="th">Flags</th>
              <th className="th">Duration</th>
              <th className="th">Started</th>
              <th className="th">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((run) => (
              <tr key={run.id} className="hover:bg-surface-2/40">
                <td className="td border-l-2" style={{ borderColor: RISK_ACCENT[run.riskLevel ?? "NONE"] ?? "transparent" }}>
                  <Link href={`/runs/${run.id}`} className="link mono">
                    {run.runExternalId ?? shortHash(run.id, 10)}
                  </Link>
                </td>
                <td className="td">
                  {run.agent ? (
                    <Link href={`/agents/${run.agent.id}`} className="text-muted hover:text-text">
                      {run.agent.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="td">
                  <StatusBadge status={run.status} />
                </td>
                <td className="td">
                  <RiskChip level={run.riskLevel} />
                </td>
                <td className="td mono text-muted">{run._count?.events ?? "—"}</td>
                <td className="td mono text-muted">{run._count?.riskFlags ?? 0}</td>
                <td className="td mono text-muted">{formatDuration(run.startedAt, run.endedAt)}</td>
                <td className="td text-muted">{formatRelative(run.startedAt)}</td>
                <td className="td">
                  {run.receiptHash ? (
                    <span className="mono text-2xs text-verified">{shortHash(run.receiptHash, 10)}</span>
                  ) : (
                    <span className="text-2xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={9}>
                  No runs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-surface px-2 py-1.5 text-sm normal-case text-text focus:border-trace focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
