import { notFound } from "next/navigation";
import { verifyReceipt, type Receipt } from "@agenttrace/shared";
import { ApiUnavailable, getReceipt } from "../../../../lib/api";
import { Breadcrumb, PageHeader, StatCard } from "../../../../components/ui";
import { RiskChip } from "../../../../components/badges";
import { ErrorState } from "../../../../components/states";
import { JsonViewer } from "../../../../components/JsonViewer";
import { CopyButton } from "../../../../components/CopyButton";
import { formatDateTime, shortHash } from "../../../../lib/format";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  let receipt: Receipt | null;
  try {
    receipt = (await getReceipt(params.id)) as Receipt | null;
  } catch (err) {
    if (err instanceof ApiUnavailable) {
      return <ErrorState title="API unavailable" detail={err.message} />;
    }
    // 409 not finalized etc.
    return (
      <ErrorState
        title="No receipt available"
        detail="This run has not been finalized yet. Finalize the run to seal a receipt."
      />
    );
  }
  if (!receipt) notFound();

  const verification = verifyReceipt(receipt);
  const { body } = receipt;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Runs", href: "/runs" },
          { label: body.run.runExternalId ?? shortHash(body.run.id, 10), href: `/runs/${params.id}` },
          { label: "Receipt" },
        ]}
      />
      <PageHeader
        title="Signed receipt"
        subtitle={`${body.version} · ${body.hashAlgorithm} / ${body.signatureAlgorithm}`}
        actions={<CopyButton value={JSON.stringify(receipt, null, 2)} label="Copy receipt" />}
      />

      {/* Verification banner */}
      <div
        className={`mb-5 flex items-center gap-3 rounded-md border px-4 py-3 ${
          verification.valid
            ? "border-verified/40 bg-verified/10"
            : "border-critical/40 bg-critical/10"
        }`}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
            verification.valid ? "bg-verified/20 text-verified" : "bg-critical/20 text-critical"
          }`}
        >
          {verification.valid ? "✓" : "✕"}
        </span>
        <div>
          <p className={`text-sm font-medium ${verification.valid ? "text-verified" : "text-critical"}`}>
            {verification.valid ? "Receipt verified" : "Verification failed"}
          </p>
          <p className="text-2xs text-muted">
            Run hash {verification.hashValid ? "matches" : "MISMATCH"} · signature{" "}
            {verification.signatureValid ? "valid" : "INVALID"} · verified independently from the
            receipt body.
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Events sealed" value={body.eventCount} />
        <StatCard label="Approvals" value={body.approvals.length} />
        <StatCard label="Risk level" value={<RiskChip level={body.run.riskLevel} />} />
        <StatCard label="Risk flags" value={body.riskFlags.length} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="panel p-4">
          <span className="stat-label">Run hash</span>
          <p className="mt-1 mono break-all text-sm text-verified">{receipt.runHash}</p>
        </div>
        <div className="panel p-4">
          <span className="stat-label">Signature (Ed25519)</span>
          <p className="mt-1 mono break-all text-sm text-muted">{receipt.signature}</p>
        </div>
        <div className="panel p-4">
          <span className="stat-label">Signed by (public key)</span>
          <p className="mt-1 mono break-all text-sm text-muted">{receipt.signedBy}</p>
        </div>
        <div className="panel p-4">
          <span className="stat-label">Generated</span>
          <p className="mt-1 text-sm text-text">{formatDateTime(receipt.generatedAt)}</p>
          {body.policy && (
            <p className="mt-2 text-2xs text-muted">
              Policy: {body.policy.name} v{body.policy.version} · {shortHash(body.policy.policyHash, 16)}
            </p>
          )}
        </div>
      </div>

      <JsonViewer data={receipt} title="receipt.json" />
    </>
  );
}
