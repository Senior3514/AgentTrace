import { verifyReceipt, type Receipt, type ReceiptVerification } from "@agenttrace/shared";
import type {
  Agent,
  AgentTraceClientOptions,
  CreateAgentArgs,
  CreateOwnerArgs,
  CreatePolicyArgs,
  FinalizeRunArgs,
  Owner,
  Policy,
  ReportApprovalArgs,
  ReportAttestationArgs,
  ReportEventArgs,
  Run,
  StartRunArgs,
} from "./types.js";

export class AgentTraceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AgentTraceError";
  }
}

/**
 * Thin typed client for the AgentTrace API.
 *
 * Write calls carry the API key; read calls do not require it. Dates are
 * serialized to ISO strings automatically.
 */
export class AgentTraceClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AgentTraceClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("No fetch implementation available; pass one via options.fetch");
    }
  }

  // --- Owners / agents / policies ---
  createOwner(args: CreateOwnerArgs): Promise<Owner> {
    return this.post("/v1/owners", args);
  }

  createAgent(args: CreateAgentArgs): Promise<Agent> {
    return this.post("/v1/agents", args);
  }

  createPolicy(args: CreatePolicyArgs): Promise<Policy> {
    return this.post("/v1/policies", args);
  }

  // --- Runs / events ---
  startRun(args: StartRunArgs): Promise<Run> {
    return this.post("/v1/runs", serializeDates(args));
  }

  reportEvent(args: ReportEventArgs): Promise<unknown> {
    return this.post("/v1/events", serializeDates(args));
  }

  reportApproval(args: ReportApprovalArgs): Promise<unknown> {
    return this.post("/v1/approvals", serializeDates(args));
  }

  reportAttestation(args: ReportAttestationArgs): Promise<unknown> {
    return this.post("/v1/attestations", args);
  }

  finalizeRun(runId: string, args: FinalizeRunArgs = {}): Promise<{ receipt: Receipt; riskLevel: string }> {
    return this.post(`/v1/runs/${encodeURIComponent(runId)}/finalize`, serializeDates(args));
  }

  // --- Reads ---
  getRun(runId: string): Promise<Run & Record<string, unknown>> {
    return this.get(`/v1/runs/${encodeURIComponent(runId)}`);
  }

  getReceipt(runId: string): Promise<Receipt> {
    return this.get(`/v1/runs/${encodeURIComponent(runId)}/receipt`);
  }

  listRuns(params: { limit?: number; offset?: number } = {}): Promise<{ items: Run[]; total: number }> {
    return this.get(`/v1/runs${toQuery(params)}`);
  }

  listAgents(params: { limit?: number; offset?: number } = {}): Promise<{ items: Agent[]; total: number }> {
    return this.get(`/v1/agents${toQuery(params)}`);
  }

  /**
   * Verify a receipt locally: recompute the run hash from the receipt body and
   * (optionally) check the Ed25519 signature against the embedded public key.
   */
  verifyReceipt(receipt: Receipt): ReceiptVerification {
    return verifyReceipt(receipt);
  }

  // --- HTTP plumbing ---
  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const err = data as { error?: string; message?: string; details?: unknown } | undefined;
      throw new AgentTraceError(
        res.status,
        err?.error ?? "request_failed",
        err?.message ?? `Request failed with status ${res.status}`,
        err?.details,
      );
    }
    return data as T;
  }
}

function serializeDates<T extends object>(args: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

function toQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)] as [string, string]));
  return `?${qs.toString()}`;
}
