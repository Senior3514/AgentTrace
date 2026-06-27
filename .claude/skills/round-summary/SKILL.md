---
name: round-summary
description: Write the end to end summary after an autonomous build/improvement round. Use once a change is merged, to report back. Produces a concise, honest summary in the user's language (Hebrew) covering what changed, why it matters, the single strongest piece of real evidence, and the current full system state.
---

# round-summary

Close every round with a tight, honest report. No filler, no congratulations.

## Format

1. One line on what shipped (PR number and title).
2. Why it matters: the concrete problem it fixed or value it added, in plain
   terms.
3. The single strongest real evidence: a test count, a falsifiability
   demonstration (failed on old code, passed on new), a captured run output, or
   a live check result. Paste the actual line, do not paraphrase.
4. Current full system state: `pnpm -r typecheck` result (7 packages), total test
   count, build status, and the live deploy state if relevant.
5. If nothing high value shipped this round, say so plainly and report the deeper
   verification or small polish done instead. Do not invent work.

## Rules

- Write in Hebrew (the user's language), concise.
- Use a regular hyphen (-) in any text, never an em dash. The em dash reads as
  non human and is banned in this project's writing.
- Be faithful: if something could not be verified here (live Vercel with a real
  DB, an Electron GUI), say exactly what you could and could not check.
