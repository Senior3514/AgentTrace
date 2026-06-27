# Deploying AgentTrace to Vercel

## Simplest working API (3 steps)

For the **API** project (Root Directory = `apps/api`):

1. **Add a database.** In the project → *Storage*, create a Postgres database
   (Vercel/Neon/Prisma Postgres/Supabase all work). The integration adds its
   connection env var - whatever it's named (`DATABASE_URL`,
   `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, …); **AgentTrace auto-detects it**, so
   no manual mapping is needed.
2. **Set two env vars:** `DEMO_MODE=true` and `RECEIPT_SIGNING_KEY=<hex>`
   (`pnpm keys:generate`). Redeploy.
3. **Turn off Deployment Protection** (*Settings → Deployment Protection*) so the
   API is publicly reachable.

That's it. The build **auto-applies migrations** (`prisma migrate deploy`,
against whichever DB var is present) and, with `DEMO_MODE=true`, the API
**auto-seeds** four demo runs on first boot.
Verify: `curl https://<api>.vercel.app/health` →
`{"status":"ok","db":"up"}` (`db:"down"` means no database is attached yet).

---

AgentTrace deploys as **two Vercel projects from this one monorepo**:

| Project | Root Directory | What it is |
| --- | --- | --- |
| `agenttrace-api` | `apps/api` | Fastify API as a serverless function |
| `agenttrace-dashboard` | `apps/dashboard` | Next.js dashboard |

> Names are illustrative - rename the projects freely; only the env vars below
> need to match up.

## If you imported the repo as a single root project

A common first mistake is importing the repo with **Root Directory = the repo
root** and no framework. Vercel then runs a generic build, finds no output, and
fails with:

> Build Failed - No Output Directory named "public" found after the Build completed.

This repo ships a root [`vercel.json`](../vercel.json) that resolves that case
by building the **dashboard** from the root:

```jsonc
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @agenttrace/dashboard build",
  "outputDirectory": "apps/dashboard/.next"
}
```

So a root-level project deploys the dashboard out of the box. The **API** still
needs its own project (next section) - one Vercel project builds one app.

> Most robust alternative: instead of relying on the root config, set each
> project's **Root Directory** to `apps/dashboard` / `apps/api`. Then the
> per-app `vercel.json` files apply and the root one is ignored.

## Prerequisites

- A **hosted PostgreSQL** with connection pooling (serverless opens many short
  connections). Neon, Supabase, or Vercel Postgres all work. Use the **pooled**
  connection string as `DATABASE_URL`.
- An Ed25519 signing key: run `pnpm keys:generate` and copy the hex values.

## 1. API project (`apps/api`)

Import the repo, set **Root Directory = `apps/api`**. `apps/api/vercel.json`
configures the build (`prisma generate` + an esbuild bundle step) and rewrites
every path to the Fastify handler.

> The build step bundles the serverless function with esbuild
> (`vercel-build.mjs` → `api/_server.js`), inlining the workspace package
> `@agenttrace/shared` (TypeScript source) while keeping Fastify/Prisma/Zod
> external. This is what avoids the `TS2305/TS2339` resolution errors Vercel's
> builder otherwise hits on the raw `.ts` function, and guarantees the deployed
> function is self-contained. Verified locally by running the bundle under plain
> `node` (no `tsx`): `/health` → 200, `/v1/runs` → 200.

> The API is serverless-only (no static frontend). Vercel still requires an
> output directory to exist after a custom build command, so `vercel.json`
> creates an empty `public/` (`outputDirectory: public`) purely to satisfy that
> check - without it the build fails with *No Output Directory named "public"*.

Environment variables:

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | pooled Postgres connection string |
| `RECEIPT_SIGNING_KEY` | ✅ | hex Ed25519 seed from `pnpm keys:generate` |
| `RECEIPT_PUBLIC_KEY` | optional | derived from the signing key if omitted |
| `API_KEYS` | ✅ | comma-separated global/admin keys |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | optional | defaults `1000` / `1 minute` |

**Run migrations against the production database** before (or right after) the
first deploy - serverless functions must not migrate on cold start:

```bash
DATABASE_URL="<pooled-or-direct-url>" pnpm prisma migrate deploy
```

(Prisma `binaryTargets` already include `rhel-openssl-3.0.x` for the Lambda
runtime, so the client works once generated during the build.)

### Troubleshooting: `FUNCTION_INVOCATION_FAILED` / "This Serverless Function has crashed"

This almost always means **`DATABASE_URL` is not set** on the project. The
Prisma client is constructed lazily (`apps/api/src/db.ts`), so a missing
`DATABASE_URL` no longer crashes the function at cold start - but the API still
needs a database to do anything. Check liveness vs. DB readiness:

```bash
curl https://<api>.vercel.app/health
# { "status": "ok", "db": "up" }    ← function alive AND database reachable
# { "status": "ok", "db": "down" }  ← function alive, but DATABASE_URL missing/unreachable
```

If `db` is `down`: set `DATABASE_URL` to a **pooled** Postgres URL in the Vercel
project's Environment Variables, redeploy, and run `prisma migrate deploy`
against it. (If `/health` itself 500s, the crash is something else - inspect the
function logs.)

### Deployment Protection

A fresh Vercel project may return **HTTP 401/403** on every request because
**Deployment Protection** (Vercel Authentication) is on by default. For a public
API, turn it off under *Project → Settings → Deployment Protection*, or add a
bypass token. This is why `https://<api>.vercel.app/` can show a 403 even when
the function is healthy.

Verify: `curl https://<api-project>.vercel.app/health` → `{"status":"ok",...}`.

## 2. Dashboard project (`apps/dashboard`)

Import the same repo as a second project, **Root Directory = `apps/dashboard`**
(framework auto-detected as Next.js). The standalone Next config already traces
the monorepo root.

Environment variables - both point at the API deployment:

| Var | Used by |
| --- | --- |
| `AGENTTRACE_API_URL` | server-side data fetching (SSR) |
| `NEXT_PUBLIC_AGENTTRACE_API_URL` | client (export button, live API-status pill) |

```
AGENTTRACE_API_URL=https://<api-project>.vercel.app
NEXT_PUBLIC_AGENTTRACE_API_URL=https://<api-project>.vercel.app
```

The header shows a live **API online/offline** pill so you can confirm the
dashboard reaches the API across the two deployments.

## Local parity

`vercel dev` works per project, but the simplest local loop is unchanged:
`docker compose up` (or `pnpm dev:api` + `pnpm dev:dashboard`). The serverless
entry (`apps/api/api/index.ts`) just wraps the same `buildApp()` used in dev, so
behavior is identical.
