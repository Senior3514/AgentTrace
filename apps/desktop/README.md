# @agenttrace/desktop

A security-hardened [Electron](https://www.electronjs.org/) shell around the
AgentTrace dashboard, packaged as a native desktop app. The dashboard remains a
pure web app; this only frames it.

## What it does

- **First run shows a Connect screen** - paste your AgentTrace dashboard URL
  (e.g. your Vercel deployment), *Test connection*, then *Connect*. The choice is
  remembered; subsequent launches open straight into your dashboard.
- Opens the dashboard in a native window (`contextIsolation` on,
  `nodeIntegration` off, `sandbox` on - no Node APIs exposed to the page; a small
  audited IPC bridge powers only the connect screen).
- Opens external links (GitHub, the API host) in the system browser.
- Single-instance; native menu (*File → Connect to a deployment…*, reload,
  devtools, zoom, fullscreen).

## Pointing it at a dashboard

Resolution order:

1. The URL you entered on the **Connect screen** (persisted per user), then
2. the `AGENTTRACE_DASHBOARD_URL` env var, then
3. the Connect screen (first run / nothing configured).

To pre-seed the URL (e.g. for a managed rollout):

```bash
AGENTTRACE_DASHBOARD_URL=https://<dashboard>.vercel.app pnpm --filter @agenttrace/desktop start
```

## Develop / run

```bash
# 1. have a dashboard reachable (local or deployed)
pnpm dev:dashboard            # http://localhost:3000

# 2. launch the desktop shell
pnpm --filter @agenttrace/desktop start
```

## Package installers

```bash
pnpm --filter @agenttrace/desktop dist
# → apps/desktop/release/ (dmg / nsis / AppImage per platform)
```

Build on (or cross-build for) the target OS. Add `build/icon.{icns,ico,png}`
to brand the app.

> Note on the Electron binary: pnpm ignores Electron's install script by
> default, so a plain `pnpm install` (e.g. in CI) does **not** download the
> ~150 MB runtime - typecheck/build of this package work without it. To actually
> launch or package the app, approve the download once with
> `pnpm approve-builds` (or `pnpm rebuild electron`).
