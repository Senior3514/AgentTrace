# @agenttrace/desktop

A security-hardened [Electron](https://www.electronjs.org/) shell around the
AgentTrace dashboard, packaged as a native desktop app. The dashboard remains a
pure web app; this only frames it.

## What it does

- Opens the dashboard in a native window (`contextIsolation` on,
  `nodeIntegration` off, `sandbox` on — no Node APIs exposed to the page).
- Opens external links (GitHub, the API host) in the system browser.
- Single-instance; native application menu (reload, devtools, zoom, fullscreen).

## Pointing it at a dashboard

Resolution order:

1. `dashboardUrl` in the per-user config file
   (*File → Edit Dashboard URL…* opens it), then
2. the `AGENTTRACE_DASHBOARD_URL` env var, then
3. `http://localhost:3000` (local dev default).

For a fully hosted setup, point it at your Vercel dashboard deployment:

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
> ~150 MB runtime — typecheck/build of this package work without it. To actually
> launch or package the app, approve the download once with
> `pnpm approve-builds` (or `pnpm rebuild electron`).
