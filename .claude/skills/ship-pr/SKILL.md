---
name: ship-pr
description: Take a finished, verified change on a feature branch all the way to merged. Use after implementing and locally verifying an improvement. Commits with the repo conventions, pushes, opens a non draft PR with pasted real evidence, watches CI (GitHub Actions plus Vercel), and squash merges when everything is green.
---

# ship-pr

The full pull request lifecycle, done the same way every time.

## Preconditions

- You are on a `feat/*` or `fix/*` branch off the latest main.
- The change is locally verified with real evidence (typecheck, tests, build,
  and a run of the thing where relevant). Never ship a red baseline.

## Steps

1. Commit and push:
   ```bash
   git add -A
   git commit -q -m "<concise imperative subject>

   <body: what changed and why it matters, plus the verification done>"
   git push -u origin <branch>
   ```
   Use a regular hyphen (-) in prose, never an em dash.
2. Open the PR via the GitHub MCP `create_pull_request` (owner `senior3514`,
   repo `agenttrace`, base `main`, draft false). The body must include:
   - what changed and why
   - pasted real evidence (test counts, typecheck result, captured run output)
   - an honest "could NOT verify" line if anything could not be checked here
3. Watch CI with `pull_request_read` method `get_check_runs`. Required green:
   - `Typecheck & test` (GitHub Actions)
   - `Build dashboard` (GitHub Actions)
   - Vercel: `success`, or `Skipped` for changes that do not touch `apps/api`
     (the Vercel project's root directory), or `Ready`
4. When all are green, squash merge via the GitHub MCP `merge_pull_request`
   (`merge_method` squash).

## Notes

- Vercel preview URLs sit behind Deployment Protection (HTTP 403 to outsiders);
  a 403 is the protection wall, not a build failure. The deployment status
  (Ready/Skipped/Success) is the signal.
- One focused change per PR. Quality over quantity.
- End commit messages with the repo's Co-Authored-By / session trailers.
