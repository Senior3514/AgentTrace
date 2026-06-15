import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiUnavailable, getAgent, getAgentRuns } from "../../../lib/api";
import { Breadcrumb, PageHeader, StatCard, Table } from "../../../components/ui";
import { RiskChip, StatusBadge } from "../../../components/badges";
import { EmptyState, ErrorState } from "../../../components/states";
import { formatDuration, formatRelative, shortHash } from "../../../lib/format";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  let agent;
  let runsData;
  try {
    [agent, runsData] = await Promise.all([getAgent(params.id), getAgentRuns(params.id)]);
  } catch (err) {
    if (err instanceof ApiUnavailable) {
      return <ErrorState title="API unavailable" detail={err.message} />;
    }
    throw err;
  }
  if (!agent) notFound();

  const runs = runsData?.items ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: "Agents", href: "/agents" }, { label: agent.name }]} />
      <PageHeader title={agent.name} subtitle={agent.externalId} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Owner" value={agent.owner?.name ?? "—"} />
        <StatCard label="Environment" value={agent.environment} />
        <StatCard label="Framework" value={agent.framework ?? "—"} />
        <StatCard label="Total runs" value={agent._count?.runs ?? runs.length} />
      </div>

      <h2 className="mb-2 text-sm font-medium text-text">Runs</h2>
      {runs.length === 0 ? (
        <EmptyState title="No runs for this agent yet" />
      ) : (
        <Table>
          <thead className="border-b border-border bg-surface-2/40">
            <tr>
              <th className="th">Run</th>
              <th className="th">Status</th>
              <th className="th">Risk</th>
              <th className="th">Events</th>
              <th className="th">Duration</th>
              <th className="th">Started</th>
              <th className="th">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-surface-2/40">
                <td className="td">
                  <Link href={`/runs/${run.id}`} className="link mono">
                    {run.runExternalId ?? shortHash(run.id, 10)}
                  </Link>
                </td>
                <td className="td">
                  <StatusBadge status={run.status} />
                </td>
                <td className="td">
                  <RiskChip level={run.riskLevel} />
                </td>
                <td className="td mono text-muted">{run._count?.events ?? "—"}</td>
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
