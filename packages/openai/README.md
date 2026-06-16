# @agenttrace/openai

Wrap an OpenAI tool-calling session so it produces a **signed AgentTrace
receipt**: a run is created, the model response + tool calls are recorded as
events (mapped to action classes / mutation flags), and the run is finalized.

The OpenAI → AgentTrace **mapping is pure and deterministic** (`src/mapping.ts`)
— no clock, no randomness — so it is unit-tested offline with recorded OpenAI
responses. The AgentTrace side (run, events, receipt, verification) is real.

## Tool classification (deterministic, ordered)

| Tool name matches | actionClass | mutates | irreversible |
| --- | --- | --- | --- |
| `secret`, `credential`, `token`, `vault`, `api_key` | `SECRET_ACCESS` | – | – |
| `delete`, `drop`, `destroy`, `purge`, `terminate`, `revoke` | `WRITE` | ✓ | ✓ |
| `exec`, `run_`, `shell`, `code_interpreter`, `python`, `sandbox` | `CODE_EXECUTION` | – | – |
| `send`, `create`, `update`, `deploy`, `merge`, `push`, `charge`, … | `EXTERNAL_CALL` | ✓ | – |
| `read`, `get`, `list`, `search`, `fetch`, `query`, … | `READ` | – | – |
| (anything else) | `OTHER` | – | – |

## Usage

```ts
import { AgentTraceClient } from "@agenttrace/sdk";
import { TracedSession } from "@agenttrace/openai";

const at = new AgentTraceClient({ baseUrl, apiKey });
const session = new TracedSession({ agenttrace: at, agentId, policyId });

await session.start();
const completion = await openai.chat.completions.create({ /* … tools … */ });
await session.recordCompletion(completion);
await session.recordToolResult({ toolName: "create_pull_request", isError: false });
const { receipt, riskLevel } = await session.finish();

at.verifyReceipt(receipt); // { valid: true, … } — offline Ed25519
```

## Runnable example

```bash
# Needs the AgentTrace API running (see repo Quickstart).
AGENTTRACE_API_URL=http://localhost:4000 AGENTTRACE_API_KEY=dev_key_local \
  pnpm --filter @agenttrace/openai example
```

- With `OPENAI_API_KEY` set, the example calls the **real** OpenAI API.
- Without it, the example uses a **recorded** OpenAI response — but the
  AgentTrace run, receipt, and verification are still fully real. The script
  prints which path it used.

## Tests

```bash
pnpm --filter @agenttrace/openai test   # offline mapping tests, no network/DB
```
