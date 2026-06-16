// Deterministic mapping from OpenAI Chat Completions responses to AgentTrace
// events. Pure functions only — no I/O, no clock, no randomness — so the
// OpenAI-side mapping is fully unit-testable offline with recorded fixtures.

import type { ActionClass } from "@agenttrace/shared";

/** Structural subset of an OpenAI tool call we rely on (SDK-version tolerant). */
export interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

export interface OpenAIMessage {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAIChoice {
  index?: number;
  finish_reason?: string | null;
  message?: OpenAIMessage;
}

export interface OpenAIChatCompletion {
  id?: string;
  model?: string;
  choices?: OpenAIChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** An AgentTrace event derived from the OpenAI response, ready for the SDK. */
export interface MappedEvent {
  eventType: string;
  actionClass: ActionClass;
  actorType: "AGENT" | "SYSTEM" | "TOOL";
  toolName?: string;
  targetSystem?: string;
  mutatesState: boolean;
  irreversible: boolean;
  metadataJson: Record<string, unknown>;
}

export interface ToolClassification {
  actionClass: ActionClass;
  mutatesState: boolean;
  irreversible: boolean;
}

// Ordered, deterministic classification rules. Earlier matches win, so the more
// sensitive/severe categories are checked first.
const RULES: Array<{ re: RegExp; cls: ToolClassification }> = [
  { re: /(secret|credential|token|password|passwd|vault|api[_-]?key|private[_-]?key)/i,
    cls: { actionClass: "SECRET_ACCESS", mutatesState: false, irreversible: false } },
  { re: /(delete|destroy|drop|purge|remove|wipe|terminate|revoke|rm_)/i,
    cls: { actionClass: "WRITE", mutatesState: true, irreversible: true } },
  { re: /(exec|execute|run_|shell|bash|sh_|code_interpreter|python|compile|sandbox|eval)/i,
    cls: { actionClass: "CODE_EXECUTION", mutatesState: false, irreversible: false } },
  { re: /(send|post|create|update|write|put|patch|deploy|merge|push|email|charge|payment|transfer|provision|publish)/i,
    cls: { actionClass: "EXTERNAL_CALL", mutatesState: true, irreversible: false } },
  { re: /(read|get|list|search|fetch|query|lookup|view|describe|inspect)/i,
    cls: { actionClass: "READ", mutatesState: false, irreversible: false } },
];

/** Classify a tool by name into a deterministic action class + mutation flags. */
export function classifyTool(name: string): ToolClassification {
  const n = (name ?? "").trim();
  for (const rule of RULES) {
    if (rule.re.test(n)) return { ...rule.cls };
  }
  return { actionClass: "OTHER", mutatesState: false, irreversible: false };
}

function parseArgs(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // keep the raw string if it isn't valid JSON
  }
}

/** Map a single tool call to an AgentTrace event. */
export function mapToolCall(call: OpenAIToolCall): MappedEvent {
  const name = call.function?.name ?? "unknown_tool";
  const c = classifyTool(name);
  return {
    eventType: `tool_call:${name}`,
    actionClass: c.actionClass,
    actorType: "AGENT",
    toolName: name,
    mutatesState: c.mutatesState,
    irreversible: c.irreversible,
    metadataJson: {
      toolCallId: call.id ?? null,
      arguments: parseArgs(call.function?.arguments),
    },
  };
}

/** Map the result of a tool execution back into an event (errors flagged). */
export function mapToolResult(args: {
  toolName: string;
  toolCallId?: string;
  isError?: boolean;
  summary?: string;
}): MappedEvent {
  const c = classifyTool(args.toolName);
  return {
    eventType: args.isError ? `tool_error:${args.toolName}` : `tool_result:${args.toolName}`,
    // A tool *result* is observational; classify the access but it doesn't itself mutate.
    actionClass: args.isError ? "OTHER" : c.actionClass,
    actorType: "TOOL",
    toolName: args.toolName,
    mutatesState: false,
    irreversible: false,
    metadataJson: {
      toolCallId: args.toolCallId ?? null,
      isError: Boolean(args.isError),
      summary: args.summary ?? null,
    },
  };
}

/**
 * Map a full chat completion to an ordered list of AgentTrace events:
 * one `model_response` event per choice, then one event per tool call. The
 * assistant's finish_reason is surfaced (e.g. `content_filter`, `length`) so
 * model-side risk signals land in the trail.
 */
export function mapChatCompletion(completion: OpenAIChatCompletion): MappedEvent[] {
  const events: MappedEvent[] = [];
  const choices = completion.choices ?? [];

  for (const choice of choices) {
    const finish = choice.finish_reason ?? null;
    const toolCalls = choice.message?.tool_calls ?? [];
    events.push({
      eventType: "model_response",
      actionClass: "CONTROL",
      actorType: "AGENT",
      mutatesState: false,
      irreversible: false,
      metadataJson: {
        model: completion.model ?? null,
        finishReason: finish,
        // content_filter / length are model-side conditions worth recording.
        flagged: finish === "content_filter" || finish === "length",
        toolCallCount: toolCalls.length,
        usage: completion.usage ?? null,
      },
    });

    for (const call of toolCalls) {
      events.push(mapToolCall(call));
    }
  }

  return events;
}
