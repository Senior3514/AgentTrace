import Link from "next/link";
import { JsonViewer } from "../components/JsonViewer";

export const dynamic = "force-static";

const SAMPLE_RECEIPT = {
  body: {
    version: "agenttrace.receipt.v1",
    hashAlgorithm: "sha256",
    signatureAlgorithm: "ed25519",
    run: { id: "run_8f…", status: "FINALIZED", riskLevel: "HIGH" },
    agent: { externalId: "coding-agent-01", environment: "production" },
    eventCount: 8,
    events: [
      { seqNo: 2, eventType: "open_pr", actionClass: "EXTERNAL_CALL", eventHash: "3b9c…" },
      { seqNo: 6, eventType: "merge_pr", irreversible: true, eventHash: "a41f…" },
    ],
    approvals: [{ approverId: "alice@acme.dev", decision: "APPROVED" }],
    riskFlags: [{ flagType: "irreversible_action", severity: "HIGH" }],
  },
  runHash: "b4a41aa27802dd8ef9d9e9f3417f458cf84002b850663953992530deb83e6c64",
  signature: "ed25519:9f3c…",
  signedBy: "8a2e…",
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-12">
      <div className="stat-label">{eyebrow}</div>
      <h2 className="mt-2 font-sans text-xl font-semibold tracking-tight text-text">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero */}
      <section className="py-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-2xs uppercase tracking-wider text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-verified" />
          Execution evidence layer for AI agents
        </div>
        <h1 className="mt-5 font-sans text-4xl font-semibold leading-tight tracking-tight text-text">
          Prove what your agents <span className="text-verified">actually did</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          AgentTrace records runtime events, binds each action to policy and approval context, and
          seals finalized runs into signed, independently verifiable receipts. Trust from evidence,
          not claims.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/runs"
            className="rounded-md bg-verified px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
          >
            Open dashboard
          </Link>
          <a
            href="#quickstart"
            className="rounded-md border border-border px-4 py-2 text-sm text-text hover:border-trace"
          >
            Developer quickstart
          </a>
        </div>
      </section>

      <Section eyebrow="Why now" title="Agents act. Few systems can prove how.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              t: "Verification, not chat",
              d: "The hard problem in agentic AI is provenance and verifiable execution - a layer that returns proof of what ran.",
            },
            {
              t: "Actions are consequential",
              d: "Agents open PRs, move money, touch secrets, and call external systems. Important actions must be traceable.",
            },
            {
              t: "Approvals must bind",
              d: "Human approvals only matter if they are visible and bound to the exact action they authorized.",
            },
          ].map((c) => (
            <div key={c.t} className="panel p-4">
              <h3 className="text-sm font-medium text-text">{c.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="What AgentTrace captures" title="A tamper-evident trail per run">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            "Ordered runtime events",
            "Action class & mutation flags",
            "Tool & target system",
            "SHA-256 hash chain",
            "Policy binding",
            "Human approvals",
            "Deterministic risk flags",
            "Ed25519 signed receipt",
          ].map((item) => (
            <div key={item} className="panel px-3 py-3 text-sm text-text">
              <span className="mr-1.5 text-verified">▸</span>
              {item}
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Sample receipt" title="Every finalized run produces verifiable proof">
        <JsonViewer data={SAMPLE_RECEIPT} title="receipt.json (excerpt)" />
      </Section>

      <Section eyebrow="Quickstart" title="Instrument a run in a few calls">
        <div id="quickstart" className="panel overflow-hidden">
          <div className="border-b border-border px-3 py-2">
            <span className="stat-label">TypeScript SDK</span>
          </div>
          <pre className="overflow-auto bg-bg px-4 py-4 mono leading-relaxed text-muted">
{`import { AgentTraceClient } from "@agenttrace/sdk";

const at = new AgentTraceClient({
  baseUrl: "http://localhost:4000",
  apiKey: process.env.AGENTTRACE_API_KEY!,
});

const run = await at.startRun({ agentId, policyId });
await at.reportEvent({ runId: run.id, seqNo: 0,
  eventType: "merge_pr", actionClass: "EXTERNAL_CALL",
  mutatesState: true, irreversible: true });
await at.reportApproval({ runId: run.id, approverId: "alice",
  decision: "APPROVED" });

const { receipt } = await at.finalizeRun(run.id);
at.verifyReceipt(receipt); // { valid: true }`}
          </pre>
        </div>
      </Section>

      {/* CTA footer */}
      <section className="border-t border-border py-12">
        <div className="panel flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-sans text-lg font-semibold text-text">
              Make agent execution defensible.
            </h2>
            <p className="mt-1 text-sm text-muted">
              Record the evidence. Seal the receipt. Verify anywhere.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="rounded-md border border-border px-4 py-2 text-sm text-text hover:border-trace"
            >
              Verify a receipt
            </Link>
            <Link
              href="/runs"
              className="rounded-md bg-verified px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
            >
              Explore runs →
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-2xs uppercase tracking-wider text-muted">
          AgentTrace · execution evidence layer · v0
        </p>
      </section>
    </div>
  );
}
