import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiUnavailable, getRun } from "../../../lib/api";
import { Breadcrumb, PageHeader, StatCard } from "../../../components/ui";
import { RiskChip, StatusBadge } from "../../../components/badges";
import { ErrorState } from "../../../components/states";
import { RunTimeline } from "../../../components/RunTimeline";
import { ExportButton } from "../../../components/ExportButton";
import { formatDateTime, formatDuration, shortHash } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  let run;
  try {
    run = await getRun(params.id);
  } catch (err) {
    if (err instanceof ApiUnavailable) {
      return <ErrorState title="API unavailable" detail={err.message} />;
    }
    throw err;
  }
  if (!run) notFound();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Runs", href: "/runs" },
          { label: run.runExternalId ?? shortHash(run.id, 10) },
        ]}
      />
      <PageHeader
        title={run.runExternalId ?? "Run"}
        subtitle={run.id}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton runId={run.id} />
            {run.receiptHash ? (
              <Link
                href={`/runs/${run.id}/receipt`}
                className="rounded border border-verified/40 bg-verified/10 px-3 py-1.5 text-sm font-medium text-verified hover:bg-verified/20"
              >
                View receipt →
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Status" value={<StatusBadge status={run.status} />} />
        <StatCard label="Risk level" value={<RiskChip level={run.riskLevel} />} />
        <StatCard label="Events" value={run.events.length} />
        <StatCard label="Risk flags" value={run.riskFlags.length} />
        <StatCard label="Approvals" value={run.approvals.length} />
        <StatCard label="Duration" value={formatDuration(run.startedAt, run.endedAt)} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="panel p-4">
          <span className="stat-label">Agent</span>
          <div className="mt-1">
            <Link href={`/agents/${run.agent.id}`} className="link">
              {run.agent.name}
            </Link>
            <p className="mono text-2xs text-muted">{run.agent.externalId} · {run.agent.environment}</p>
          </div>
        </div>
        <div className="panel p-4">
          <span className="stat-label">Policy</span>
          <div className="mt-1">
            {run.policy ? (
              <>
                <span className="text-text">{run.policy.name} v{run.policy.version}</span>
                <p className="mono text-2xs text-muted">{shortHash(run.policy.policyHash, 16)}</p>
              </>
            ) : (
              <span className="text-sm text-warning">No policy bound</span>
            )}
          </div>
        </div>
        <div className="panel p-4">
          <span className="stat-label">Window</span>
          <div className="mt-1 text-sm">
            <p className="text-text">{formatDateTime(run.startedAt)}</p>
            <p className="text-muted">→ {formatDateTime(run.endedAt)}</p>
          </div>
        </div>
      </div>

      {run.riskFlags.length > 0 && (
        <div className="mb-5 panel p-4">
          <span className="stat-label">Run-level risk summary</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {run.riskFlags.map((f) => (
              <span
                key={f.id}
                title={f.description}
                className="rounded border border-border bg-surface-2 px-2 py-1 text-2xs"
              >
                <span className="mono text-text">{f.flagType}</span>
                <span className="text-muted"> · {f.severity}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <RunTimeline events={run.events} approvals={run.approvals} riskFlags={run.riskFlags} />

      {(run.artifacts.length > 0 || run.attestations.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {run.artifacts.length > 0 && (
            <div className="panel p-4">
              <span className="stat-label">Artifacts · {run.artifacts.length}</span>
              <ul className="mt-2 space-y-2">
                {run.artifacts.map((a) => (
                  <li key={a.id} className="border-t border-border pt-2 first:border-0 first:pt-0 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="mono text-text">{a.uri}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-muted">
                        {a.artifactType}
                      </span>
                    </div>
                    <p className="mono break-all text-2xs text-muted">sha256:{a.sha256}</p>
                    {a.contentPreview && (
                      <p className="mt-1 line-clamp-2 text-2xs text-muted">{a.contentPreview}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.attestations.length > 0 && (
            <div className="panel p-4">
              <span className="stat-label">Attestations · {run.attestations.length}</span>
              <ul className="mt-2 space-y-2">
                {run.attestations.map((a) => (
                  <li key={a.id} className="border-t border-border pt-2 first:border-0 first:pt-0 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-text">{a.subject}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-muted">
                        {a.attestationType}
                      </span>
                    </div>
                    <p className="text-2xs text-muted">{a.statement}</p>
                    <p className="mono break-all text-2xs text-verified">
                      sig:{shortHash(a.signature, 24)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
