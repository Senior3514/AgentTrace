// End-to-end example: drive a tiny OpenAI tool-calling agent and produce a real
// signed AgentTrace receipt.
//
//   AGENTTRACE_API_URL   (default http://localhost:4000)
//   AGENTTRACE_API_KEY   (default dev_key_local)
//   OPENAI_API_KEY       (optional) - if set, calls the real OpenAI API;
//                        otherwise a recorded fixture response is used.
//
// In BOTH modes the AgentTrace run, events, finalize, receipt and verification
// are fully real (real API + real Postgres). Only the OpenAI side is recorded
// when no key is present. The script prints which path it used.

import { AgentTraceClient } from "@agenttrace/sdk";
import { TracedSession, type OpenAIChatCompletion } from "@agenttrace/openai";

const API_URL = process.env.AGENTTRACE_API_URL ?? "http://localhost:4000";
const API_KEY = process.env.AGENTTRACE_API_KEY ?? "dev_key_local";

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_pull_request",
      description: "Open a pull request with the given title.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    },
  },
];

// Recorded OpenAI response used when OPENAI_API_KEY is absent.
const FIXTURE: OpenAIChatCompletion = {
  id: "chatcmpl-EXAMPLE",
  model: "gpt-4o-mini",
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "create_pull_request", arguments: '{"title":"Add retry logic"}' } },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
};

async function getCompletion(): Promise<{ completion: OpenAIChatCompletion; path: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { completion: FIXTURE, path: "recorded fixture (no OPENAI_API_KEY)" };
  }
  // Real OpenAI call. Imported dynamically so fixture mode needs no openai dep.
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI();
  const completion = (await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a coding agent. Use tools to act." },
      { role: "user", content: "Open a pull request titled 'Add retry logic'." },
    ],
    tools: TOOLS,
    tool_choice: "auto",
  })) as unknown as OpenAIChatCompletion;
  return { completion, path: "live OpenAI API" };
}

async function main(): Promise<void> {
  const at = new AgentTraceClient({ baseUrl: API_URL, apiKey: API_KEY });

  // Self-contained: create an owner, agent, and a policy.
  const owner = await at.createOwner({ type: "ORG", name: "OpenAI Adapter Demo" });
  const agent = await at.createAgent({
    externalId: `openai-agent-${Date.now()}`,
    name: "OpenAI Coding Agent",
    ownerId: owner.id,
    environment: "production",
    framework: "openai",
  });
  const policy = await at.createPolicy({
    ownerId: owner.id,
    name: "OpenAI Agent Policy",
    policyText: "External writes require approval.",
    rules: { requireApprovalFor: ["EXTERNAL_CALL"] },
  });

  const { completion, path } = await getCompletion();
  console.log(`OpenAI path: ${path}`);

  const session = new TracedSession({
    agenttrace: at,
    agentId: agent.id,
    policyId: policy.id,
    runExternalId: `openai-run-${Date.now()}`,
  });

  await session.start();
  const events = await session.recordCompletion(completion);
  // Simulate executing the first requested tool successfully.
  const firstTool = events.find((e) => e.toolName)?.toolName;
  if (firstTool) {
    await session.recordToolResult({ toolName: firstTool, isError: false, summary: "PR #501 opened" });
  }
  const { receipt, riskLevel } = await session.finish();

  // Verify locally (offline, via @agenttrace/shared) AND on the server.
  const local = at.verifyReceipt(receipt);
  const server = await at.getReceiptVerification(session.currentRunId!);

  console.log("\n--- AgentTrace receipt ---");
  console.log(JSON.stringify({
    runId: session.currentRunId,
    riskLevel,
    receiptVersion: receipt.receiptVersion,
    runHash: receipt.runHash,
    eventCount: receipt.body.eventCount,
    localVerify: local,
    serverVerify: { hashValid: server.hashValid, signatureValid: server.signatureValid, valid: server.valid },
  }, null, 2));

  if (!local.valid || !server.valid) {
    console.error("\nRECEIPT DID NOT VERIFY");
    process.exitCode = 1;
  } else {
    console.log("\nRECEIPT VALID ✓");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
