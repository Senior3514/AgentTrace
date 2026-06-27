---
name: vercel-doctor
description: Diagnose and keep the AgentTrace Vercel deployment healthy. Use when a deploy fails, the live API misbehaves, or after changing apps/api/vercel.json, the esbuild bundle, Prisma, or the database wiring. Validates the serverless bundle under plain node, interprets the build, and explains the live /health and protection states.
---

# vercel-doctor

The API deploys to Vercel as a serverless function bundled by esbuild. This skill
keeps that path healthy.

## The architecture

- `apps/api/vercel.json` build: `prisma generate` then `tsx vercel-migrate.ts`
  (applies migrations against whatever DB env var exists) then
  `node vercel-build.mjs` (esbuild bundles `src/vercel-handler.ts` to
  `api/_server.js`, inlining only `@agenttrace/shared`, keeping fastify/prisma
  external) then `mkdir -p public` (output dir for Vercel's check).
- `api/index.ts` is a thin `@ts-nocheck` re-export of the prebuilt bundle that
  Vercel detects as the function; rewrites send all paths to it.

## Local checks

```bash
export DATABASE_URL="postgresql://agenttrace@localhost:5432/agenttrace?schema=public"
cd apps/api && node vercel-build.mjs    # must print: Bundled api/_server.js
# Run the bundle under PLAIN node (the exact Vercel runtime: no tsx):
node --input-type=module -e '
import http from "node:http"; import h from "./api/_server.js";
const s=http.createServer((q,r)=>h(q,r));
s.listen(4400,async()=>{for(const p of ["/health","/v1/runs"]){const x=await fetch("http://localhost:4400"+p);console.log(p,x.status);}s.close();});'
```

## Interpreting the live site

- `GET /` returning `{"message":"Route GET:/ not found",...,"statusCode":404}` is
  the API working correctly: it is a JSON API with no homepage.
- `GET /health` returns `{"status":"ok","db":"up"}` when a database is attached,
  or `{"status":"ok","db":"down"}` when DATABASE_URL is missing or unreachable.
  `db:down` means: attach a Postgres in the project's Storage tab. The code auto
  detects POSTGRES_PRISMA_URL / POSTGRES_URL / DATABASE_URL and friends.
- `FUNCTION_INVOCATION_FAILED` means a cold start crash; the Prisma client is
  lazy so this should not happen for missing DATABASE_URL (only db:down).
- HTTP 403 on a preview URL is Vercel Deployment Protection, not a failure.

Full guide: docs/deploy-vercel.md.
