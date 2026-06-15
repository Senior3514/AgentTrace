import Link from "next/link";
import { ApiUnavailable, listAgents } from "../../lib/api";
import { PageHeader, Table } from "../../components/ui";
import { SummaryStrip } from "../../components/SummaryStrip";
import { EmptyState, ErrorState } from "../../components/states";
import { formatRelative } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  let data;
  try {
    data = await listAgents();
  } catch (err) {
    if (err instanceof ApiUnavailable) {
      return (
        <>
          <PageHeader title="Agents" subtitle="Registered AI agents" />
          <ErrorState title="API unavailable" detail={err.message} />
        </>
      );
    }
    throw err;
  }

  const agents = data?.items ?? [];

  return (
    <>
      <PageHeader title="Agents" subtitle={`${data?.total ?? 0} agents registered`} />
      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Register an agent via the API or run `pnpm seed` to load a sample agent."
        />
      ) : (
        <>
        <SummaryStrip
          tiles={[
            { label: "Agents", value: agents.length },
            { label: "Environments", value: new Set(agents.map((a) => a.environment)).size, accent: "trace" },
            { label: "Owners", value: new Set(agents.map((a) => a.owner?.id).filter(Boolean)).size, accent: "muted" },
            { label: "Total runs", value: agents.reduce((n, a) => n + (a._count?.runs ?? 0), 0), accent: "verified" },
          ]}
        />
        <Table>
          <thead className="border-b border-border bg-surface-2/40">
            <tr>
              <th className="th">Agent</th>
              <th className="th">External ID</th>
              <th className="th">Owner</th>
              <th className="th">Environment</th>
              <th className="th">Framework</th>
              <th className="th">Runs</th>
              <th className="th">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-surface-2/40">
                <td className="td">
                  <Link href={`/agents/${agent.id}`} className="link">
                    {agent.name}
                  </Link>
                </td>
                <td className="td mono text-muted">{agent.externalId}</td>
                <td className="td text-muted">{agent.owner?.name ?? "—"}</td>
                <td className="td">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-muted">
                    {agent.environment}
                  </span>
                </td>
                <td className="td text-muted">{agent.framework ?? "—"}</td>
                <td className="td mono text-muted">{agent._count?.runs ?? 0}</td>
                <td className="td text-muted">{formatRelative(agent.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        </>
      )}
    </>
  );
}
