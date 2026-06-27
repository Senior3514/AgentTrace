---
name: verify-baseline
description: Verify the AgentTrace workspace baseline is green before and after any change. Use at the start of every build/improvement round, and again before opening a PR. Syncs main, ensures Postgres is up and migrated, then runs frozen install, recursive typecheck, and the api + openai test suites, reporting the exact pass/fail output.
---

# verify-baseline

The foundation check every round depends on. Never start work on a red baseline.

## Steps

1. Set git identity and sync:
   ```bash
   git config user.email noreply@anthropic.com && git config user.name Claude
   git checkout main && git fetch origin main && git reset --hard origin/main
   ```
2. Ensure the database is ready (use the `db-up` skill, or inline):
   ```bash
   export DATABASE_URL="postgresql://agenttrace@localhost:5432/agenttrace?schema=public"
   pg_isready -h localhost -p 5432 -U agenttrace || \
     runuser -u ubuntu -- /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata \
       -l /tmp/pglog.log -o "-p 5432 -k /tmp -c listen_addresses='localhost'" -w start
   pnpm prisma migrate deploy >/dev/null 2>&1
   ```
3. Run the checks (electron binary skipped to keep installs light):
   ```bash
   export ELECTRON_SKIP_BINARY_DOWNLOAD=1
   pnpm install --frozen-lockfile
   pnpm -r typecheck
   pnpm --filter @agenttrace/api --filter @agenttrace/openai test
   ```

## Success criteria

- frozen install succeeds
- `pnpm -r typecheck` reports Done for all 7 packages, zero `error TS`
- api + openai test suites pass with the expected counts

## On failure

Report the exact failing output (the `error TS` lines or the failed test names).
If Postgres shows "no tests" or connection errors, it was reaped, restart it and
re-run. Do not proceed to ship anything on a red baseline.
