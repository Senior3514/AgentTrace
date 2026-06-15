// Server-side data access for the dashboard. All reads go through the
// AgentTrace API; we never hit the database directly so the dashboard stays a
// pure consumer of the evidence API.

const API_URL = process.env.AGENTTRACE_API_URL ?? "http://localhost:4000";

export class ApiUnavailable extends Error {}

async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  } catch (err) {
    throw new ApiUnavailable(
      `Could not reach the AgentTrace API at ${API_URL}. Is it running?`,
    );
  }
  if (res.status === 404) {
    return null as T;
  }
  if (!res.ok) {
    throw new Error(`API request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

export interface AgentRow {
  id: string;
  externalId: string;
  name: string;
  environment: string;
  framework: string | null;
  createdAt: string;
  owner?: { id: string; name: string; type: string };
  _count?: { runs: number };
}

export interface RunRow {
  id: string;
  runExternalId: string | null;
  status: string;
  riskLevel: string | null;
  startedAt: string;
  endedAt: string | null;
  receiptHash: string | null;
  agent?: { id: string; externalId: string; name: string };
  _count?: { events: number; riskFlags: number; approvals: number };
}

export interface EventRow {
  id: string;
  seqNo: number;
  eventType: string;
  timestamp: string;
  actorType: string;
  actorId: string | null;
  toolName: string | null;
  targetSystem: string | null;
  actionClass: string;
  mutatesState: boolean;
  irreversible: boolean;
  inputHash: string | null;
  outputHash: string | null;
  prevEventHash: string | null;
  eventHash: string | null;
  metadataJson: Record<string, unknown>;
}

export interface ApprovalRow {
  id: string;
  eventId: string | null;
  approverType: string;
  approverId: string;
  decision: string;
  reason: string | null;
  approvedAt: string;
}

export interface RiskFlagRow {
  id: string;
  eventId: string | null;
  flagType: string;
  severity: string;
  title: string;
  description: string;
}

export interface AttestationRow {
  id: string;
  attestationType: string;
  subject: string;
  statement: string;
  signedBy: string;
  signature: string;
  createdAt: string;
}

export interface RunDetail extends RunRow {
  agent: { id: string; externalId: string; name: string; environment: string };
  policy: { id: string; name: string; version: string; policyHash: string } | null;
  events: EventRow[];
  approvals: ApprovalRow[];
  riskFlags: RiskFlagRow[];
  attestations: AttestationRow[];
}

export interface ListResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export const listAgents = () => apiGet<ListResult<AgentRow>>("/v1/agents?limit=100");
export const getAgent = (id: string) => apiGet<AgentRow | null>(`/v1/agents/${id}`);
export const getAgentRuns = (id: string) =>
  apiGet<ListResult<RunRow>>(`/v1/agents/${id}/runs?limit=100`);
export const listRuns = () => apiGet<ListResult<RunRow>>("/v1/runs?limit=100");
export const getRun = (id: string) => apiGet<RunDetail | null>(`/v1/runs/${id}`);
export const getReceipt = (id: string) => apiGet<unknown>(`/v1/runs/${id}/receipt`);

export interface RunVerification {
  runId: string;
  sealedHash: string;
  recomputedHash: string;
  hashValid: boolean;
  signatureValid: boolean;
  valid: boolean;
}

export const getRunVerification = (id: string) =>
  apiGet<RunVerification | null>(`/v1/runs/${id}/receipt/verify`);
