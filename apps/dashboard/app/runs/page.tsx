import { ApiUnavailable, listRuns } from "../../lib/api";
import { PageHeader } from "../../components/ui";
import { RunsTable } from "../../components/RunsTable";
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

  return (
    <>
      <PageHeader title="Runs" subtitle={`${data?.total ?? 0} runs recorded`} />
      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Start a run via the API or run `pnpm seed` to load a sample run."
        />
      ) : (
        <RunsTable runs={runs} />
      )}
    </>
  );
}
