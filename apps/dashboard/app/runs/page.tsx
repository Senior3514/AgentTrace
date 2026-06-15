import { ApiUnavailable, listRuns } from "../../lib/api";
import { PageHeader } from "../../components/ui";
import { RunsTable } from "../../components/RunsTable";
import { SummaryStrip } from "../../components/SummaryStrip";
import { EmptyState, ErrorState } from "../../components/states";

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
  const count = (pred: (r: (typeof runs)[number]) => boolean) => runs.filter(pred).length;
  const highRisk = count((r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL");

  return (
    <>
      <PageHeader title="Runs" subtitle={`${data?.total ?? 0} runs recorded`} />
      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Start a run via the API or run `pnpm seed` to load a sample run."
        />
      ) : (
        <>
          <SummaryStrip
            tiles={[
              { label: "Total", value: runs.length },
              { label: "Running", value: count((r) => r.status === "RUNNING"), accent: "trace" },
              { label: "Finalized", value: count((r) => r.status === "FINALIZED"), accent: "verified" },
              { label: "High / critical", value: highRisk, accent: highRisk > 0 ? "critical" : "muted" },
              { label: "Receipts", value: count((r) => Boolean(r.receiptHash)), accent: "verified" },
              { label: "Failed / aborted", value: count((r) => r.status === "FAILED" || r.status === "ABORTED"), accent: "warning" },
            ]}
          />
          <RunsTable runs={runs} />
        </>
      )}
    </>
  );
}
