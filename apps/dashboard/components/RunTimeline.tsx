"use client";

import { useState } from "react";
import type { ApprovalRow, EventRow, RiskFlagRow } from "../lib/api";
import { ActionClassBadge, SeverityDot } from "./badges";
import { JsonViewer } from "./JsonViewer";
import { formatDateTime, shortHash } from "../lib/format";
import { CopyButton } from "./CopyButton";

export function RunTimeline({
  events,
  approvals,
  riskFlags,
}: {
  events: EventRow[];
  approvals: ApprovalRow[];
  riskFlags: RiskFlagRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.id ?? null);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  const flagsByEvent = groupBy(riskFlags, (f) => f.eventId);
  const approvalsByEvent = groupBy(approvals, (a) => a.eventId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Timeline */}
      <div className="panel overflow-hidden">
        <div className="border-b border-border px-3 py-2">
          <span className="stat-label">Event timeline · {events.length}</span>
        </div>
        <ol className="divide-y divide-border">
          {events.map((ev) => {
            const evFlags = flagsByEvent.get(ev.id) ?? [];
            const evApprovals = approvalsByEvent.get(ev.id) ?? [];
            const isSelected = ev.id === selectedId;
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(ev.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-surface-2" : "hover:bg-surface-2/50"
                  }`}
                >
                  <span className="w-7 shrink-0 text-right mono text-muted">{ev.seqNo}</span>
                  <span className="relative flex h-full flex-col items-center">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isSelected ? "bg-trace" : "bg-border"
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text">{ev.eventType}</span>
                      {ev.mutatesState && (
                        <span className="text-2xs text-warning" title="Mutates state">
                          ●write
                        </span>
                      )}
                      {ev.irreversible && (
                        <span className="text-2xs text-critical" title="Irreversible">
                          ●irrev
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-2xs text-muted">
                      <ActionClassBadge actionClass={ev.actionClass} />
                      {ev.toolName && <span className="mono">{ev.toolName}</span>}
                      {ev.targetSystem && <span className="mono">→ {ev.targetSystem}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {evApprovals.length > 0 && (
                      <span className="text-2xs text-verified" title="Has approval">
                        ✓
                      </span>
                    )}
                    {evFlags.map((f) => (
                      <span key={f.id} title={`${f.flagType}: ${f.title}`}>
                        <SeverityDot severity={f.severity} />
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Detail panel */}
      <div className="space-y-3">
        {selected ? (
          <EventDetail
            event={selected}
            flags={flagsByEvent.get(selected.id) ?? []}
            approvals={approvalsByEvent.get(selected.id) ?? []}
          />
        ) : (
          <div className="panel px-4 py-8 text-center text-sm text-muted">
            Select an event to inspect it.
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetail({
  event,
  flags,
  approvals,
}: {
  event: EventRow;
  flags: RiskFlagRow[];
  approvals: ApprovalRow[];
}) {
  return (
    <>
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="mono text-muted">#{event.seqNo}</span>
            <h3 className="text-sm font-semibold text-text">{event.eventType}</h3>
          </div>
          <ActionClassBadge actionClass={event.actionClass} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Actor" value={`${event.actorType}${event.actorId ? ` · ${event.actorId}` : ""}`} />
          <Field label="Timestamp" value={formatDateTime(event.timestamp)} />
          <Field label="Tool" value={event.toolName ?? "-"} mono />
          <Field label="Target" value={event.targetSystem ?? "-"} mono />
          <Field label="Mutates state" value={event.mutatesState ? "yes" : "no"} />
          <Field label="Irreversible" value={event.irreversible ? "yes" : "no"} />
        </dl>

        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <HashRow label="prev" value={event.prevEventHash} />
          <HashRow label="event" value={event.eventHash} highlight />
          {event.inputHash && <HashRow label="input" value={event.inputHash} />}
          {event.outputHash && <HashRow label="output" value={event.outputHash} />}
        </div>
      </div>

      {approvals.length > 0 && (
        <div className="panel p-4">
          <span className="stat-label">Approvals</span>
          <ul className="mt-2 space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="text-verified">{a.decision}</span>
                  <span className="text-muted"> by </span>
                  <span className="mono">{a.approverId}</span>
                </span>
                <span className="text-2xs text-muted">{formatDateTime(a.approvedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {flags.length > 0 && (
        <div className="panel p-4">
          <span className="stat-label">Risk flags</span>
          <ul className="mt-2 space-y-2">
            {flags.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm">
                <span className="mt-1">
                  <SeverityDot severity={f.severity} />
                </span>
                <span>
                  <span className="mono text-text">{f.flagType}</span>
                  <span className="text-muted"> · {f.severity}</span>
                  <p className="text-2xs text-muted">{f.description}</p>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <JsonViewer data={event.metadataJson} title="metadata" collapsedHeight={160} />
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className={`text-text ${mono ? "mono" : ""}`}>{value}</dd>
    </div>
  );
}

function HashRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="w-12 uppercase tracking-wide text-muted">{label}</span>
      <span className={`mono truncate ${highlight ? "text-verified" : "text-muted"}`}>
        {value ?? "-"}
      </span>
      {value && <CopyButton value={value} />}
    </div>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}
