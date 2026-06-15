# @agenttrace/dashboard

Next.js (App Router) dashboard for AgentTrace. Dark-first, security/observability
aesthetic. A pure consumer of the AgentTrace API — it never touches the database.

## Run

```bash
pnpm dev:dashboard       # http://localhost:3000
```

Set `AGENTTRACE_API_URL` (default `http://localhost:4000`) so server components
can reach the API.

## Pages

| Route | Purpose |
| ----- | ------- |
| `/` | Landing page (hero, why now, what's captured, sample receipt, quickstart) |
| `/agents` | Agents table |
| `/agents/[id]` | Agent detail + its runs |
| `/runs` | Runs table (status, risk, events, receipt) |
| `/runs/[id]` | Run summary cards + interactive event timeline + detail panel |
| `/runs/[id]/receipt` | Signed receipt, **verified in-page**, with JSON viewer |

## Design tokens

Defined in `tailwind.config.ts`. Palette: `bg #0A0D10`, `surface #11161B`,
`surface-2 #151C22`, `border #26313B`, `text #E8F0F7`, `muted #93A4B5`,
`verified #2EE6A6`, `trace #3BA7FF`, `warning #F6B84C`, `critical #FF5C7A`.

## Notes

- The receipt page verifies the Ed25519 signature server-side using
  `verifyReceipt` from `@agenttrace/shared` — no trust in the API required.
- `next.config.js` adds a webpack `extensionAlias` so the shared package's ESM
  `.js` specifiers resolve to its `.ts` sources.

## Build

```bash
pnpm --filter @agenttrace/dashboard build
```
