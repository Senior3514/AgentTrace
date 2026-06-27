import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyTool,
  mapChatCompletion,
  mapToolCall,
  mapToolResult,
  type OpenAIChatCompletion,
} from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/tool-calls.json", import.meta.url)), "utf8"),
) as OpenAIChatCompletion;

describe("classifyTool - deterministic", () => {
  const cases: Array<[string, string, boolean, boolean]> = [
    // name, actionClass, mutatesState, irreversible
    ["search_repository", "READ", false, false],
    ["get_file", "READ", false, false],
    ["read_deploy_secret", "SECRET_ACCESS", false, false],
    ["fetch_api_key", "SECRET_ACCESS", false, false],
    ["run_tests", "CODE_EXECUTION", false, false],
    ["python_exec", "CODE_EXECUTION", false, false],
    ["create_pull_request", "EXTERNAL_CALL", true, false],
    ["send_email", "EXTERNAL_CALL", true, false],
    ["charge_payment", "EXTERNAL_CALL", true, false],
    ["delete_branch", "WRITE", true, true],
    ["drop_table", "WRITE", true, true],
    ["frobnicate", "OTHER", false, false],
  ];

  it.each(cases)("%s -> %s", (name, actionClass, mutates, irreversible) => {
    const c = classifyTool(name);
    expect(c.actionClass).toBe(actionClass);
    expect(c.mutatesState).toBe(mutates);
    expect(c.irreversible).toBe(irreversible);
  });

  it("is order-stable and pure (same input → same output)", () => {
    expect(JSON.stringify(classifyTool("delete_user"))).toBe(JSON.stringify(classifyTool("delete_user")));
  });
});

describe("mapToolCall", () => {
  it("maps a tool call to an event with parsed arguments", () => {
    const ev = mapToolCall({ id: "call_x", function: { name: "create_pull_request", arguments: '{"title":"x"}' } });
    expect(ev.eventType).toBe("tool_call:create_pull_request");
    expect(ev.actionClass).toBe("EXTERNAL_CALL");
    expect(ev.mutatesState).toBe(true);
    expect(ev.toolName).toBe("create_pull_request");
    expect(ev.metadataJson.toolCallId).toBe("call_x");
    expect(ev.metadataJson.arguments).toEqual({ title: "x" });
  });

  it("keeps raw arguments when they are not valid JSON", () => {
    const ev = mapToolCall({ function: { name: "x", arguments: "not json" } });
    expect(ev.metadataJson.arguments).toBe("not json");
  });
});

describe("mapToolResult", () => {
  it("flags tool errors", () => {
    const ok = mapToolResult({ toolName: "create_pull_request", isError: false });
    expect(ok.eventType).toBe("tool_result:create_pull_request");
    const err = mapToolResult({ toolName: "create_pull_request", isError: true });
    expect(err.eventType).toBe("tool_error:create_pull_request");
    expect(err.actionClass).toBe("OTHER");
    expect(err.metadataJson.isError).toBe(true);
  });
});

describe("mapChatCompletion - from a recorded OpenAI response", () => {
  it("emits a model_response event then one event per tool call, in order", () => {
    const events = mapChatCompletion(fixture);
    // 1 model_response + 5 tool calls
    expect(events).toHaveLength(6);
    expect(events[0]!.eventType).toBe("model_response");
    expect(events[0]!.metadataJson.toolCallCount).toBe(5);

    const toolEvents = events.slice(1);
    expect(toolEvents.map((e) => e.actionClass)).toEqual([
      "READ", // search_repository
      "SECRET_ACCESS", // read_deploy_secret
      "CODE_EXECUTION", // run_tests
      "EXTERNAL_CALL", // create_pull_request
      "WRITE", // delete_branch
    ]);
    // delete_branch is irreversible + mutating.
    expect(toolEvents[4]!.irreversible).toBe(true);
    expect(toolEvents[4]!.mutatesState).toBe(true);
  });

  it("flags content_filter / length finish reasons on the model_response", () => {
    const filtered = mapChatCompletion({ model: "gpt-4o", choices: [{ finish_reason: "content_filter", message: {} }] });
    expect(filtered[0]!.metadataJson.flagged).toBe(true);
  });

  it("is fully deterministic for a given response", () => {
    expect(JSON.stringify(mapChatCompletion(fixture))).toBe(JSON.stringify(mapChatCompletion(fixture)));
  });
});
