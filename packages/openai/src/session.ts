// Orchestration: turn an OpenAI chat/tool-call session into an AgentTrace run
// with a signed receipt. The mapping (mapping.ts) is pure; this layer drives
// the real AgentTrace SDK to persist the evidence and finalize.

import type { AgentTraceClient, Receipt } from "@agenttrace/sdk";
import {
  mapChatCompletion,
  mapToolResult,
  type MappedEvent,
  type OpenAIChatCompletion,
} from "./mapping.js";

export interface TracedSessionOptions {
  agenttrace: AgentTraceClient;
  agentId: string;
  policyId?: string;
  runExternalId?: string;
}

/**
 * A traced OpenAI agent session. Lifecycle:
 *   start() → recordCompletion()/recordToolResult()* → finish()
 * Each call appends events with a contiguous sequence number; finish() finalizes
 * the run and returns the signed receipt.
 */
export class TracedSession {
  private seqNo = 0;
  private runId: string | null = null;

  constructor(private readonly opts: TracedSessionOptions) {}

  get currentRunId(): string | null {
    return this.runId;
  }

  /** Create the run and record the session-start control event. */
  async start(): Promise<{ runId: string }> {
    const run = await this.opts.agenttrace.startRun({
      agentId: this.opts.agentId,
      policyId: this.opts.policyId,
      runExternalId: this.opts.runExternalId,
    });
    this.runId = run.id;
    await this.append({
      eventType: "session_started",
      actionClass: "CONTROL",
      actorType: "SYSTEM",
      mutatesState: false,
      irreversible: false,
      metadataJson: {},
    });
    return { runId: run.id };
  }

  /** Record an OpenAI chat completion: the model response + any tool calls. */
  async recordCompletion(completion: OpenAIChatCompletion): Promise<MappedEvent[]> {
    const events = mapChatCompletion(completion);
    for (const ev of events) await this.append(ev);
    return events;
  }

  /** Record the outcome of executing a tool the model requested. */
  async recordToolResult(args: {
    toolName: string;
    toolCallId?: string;
    isError?: boolean;
    summary?: string;
  }): Promise<MappedEvent> {
    const ev = mapToolResult(args);
    await this.append(ev);
    return ev;
  }

  /** Finalize the run and return the signed receipt + risk level. */
  async finish(
    status: "FINALIZED" | "FAILED" | "ABORTED" = "FINALIZED",
  ): Promise<{ receipt: Receipt; riskLevel: string }> {
    const runId = this.requireRun();
    await this.append({
      eventType: "session_completed",
      actionClass: "CONTROL",
      actorType: "SYSTEM",
      mutatesState: false,
      irreversible: false,
      metadataJson: {},
    });
    return this.opts.agenttrace.finalizeRun(runId, { status });
  }

  private requireRun(): string {
    if (!this.runId) throw new Error("TracedSession not started — call start() first");
    return this.runId;
  }

  private async append(ev: MappedEvent): Promise<void> {
    const runId = this.requireRun();
    await this.opts.agenttrace.reportEvent({
      runId,
      seqNo: this.seqNo++,
      eventType: ev.eventType,
      actorType: ev.actorType,
      toolName: ev.toolName,
      targetSystem: ev.targetSystem,
      actionClass: ev.actionClass,
      mutatesState: ev.mutatesState,
      irreversible: ev.irreversible,
      metadataJson: ev.metadataJson,
    });
  }
}
