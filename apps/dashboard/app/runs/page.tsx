import Link from "next/link";
import { ApiUnavailable, listRuns } from "../../lib/api";
import { PageHeader, Table } from "../../components/ui";
import { RiskChip, StatusBadge } from "../../components/badges";
import { EmptyState, ErrorState } from "../../components/states";
import { formatDuration, formatRelative, shortHash } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  let data;
  try {
    data = await listRuns();
  } catch (err) {
    if (err instanceof ApiUnavailable) {
      return (
        <>
          <PageHeader title="Runs" subtitle="Finalized and in-flight agent runs" />
          <ErrorState title="API unavailable" detail={err.message} />
        </>
      );
    }
    throw err;
  }

  const runs = data?.items ?? [];

  return (
    <>
      <PageHeader title="Runs" subtitle={`${data?.total ?? 0} runs recorded`} />
      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Start a run via the API or run `pnpm seed` to load a sample run."
        />
      ) : (
        <Table>
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
            {runs.map((run) => (
              <tr key={run.id} className="group hover:bg-surface-2/40">
                <td className="td">
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
          </tbody>
        </Table>
      )}
    </>
  );
}
