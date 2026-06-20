import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// AgentTrace desktop: a security-hardened native shell that connects to your
// deployed AgentTrace dashboard (e.g. on Vercel). On first run it shows a
// connect screen; after that it opens straight into your dashboard.

const ENV_URL = process.env.AGENTTRACE_DASHBOARD_URL?.trim() || null;
const DOCS_URL = "https://github.com/Senior3514/AgentTrace/blob/main/docs/deploy-vercel.md";
const WELCOME_FILE = join(__dirname, "..", "renderer", "welcome.html");

let mainWindow: BrowserWindow | null = null;

function configPath(): string {
  return join(app.getPath("userData"), "config.json");
}

/** The configured dashboard URL: persisted config → env → null (first run). */
function storedUrl(): string | null {
  try {
    if (existsSync(configPath())) {
      const cfg = JSON.parse(readFileSync(configPath(), "utf8")) as { dashboardUrl?: string };
      if (cfg.dashboardUrl) return cfg.dashboardUrl;
    }
  } catch {
    /* ignore malformed config */
  }
  return ENV_URL;
}

function saveUrl(url: string): void {
  writeFileSync(configPath(), JSON.stringify({ dashboardUrl: url }, null, 2));
}

function normalizeUrl(raw: string): string | null {
  let value = (raw ?? "").trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function loadDashboardOrWelcome(): void {
  if (!mainWindow) return;
  const url = storedUrl();
  if (url) void mainWindow.loadURL(url);
  else void mainWindow.loadFile(WELCOME_FILE);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0A0D10",
    title: "AgentTrace",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  loadDashboardOrWelcome();

  // Keep navigation inside the configured dashboard origin; send everything else
  // (GitHub, the API host, docs) to the system browser.
  const isAppOrigin = (target: string) => {
    const current = storedUrl();
    if (!current) return false;
    try {
      return new URL(target).origin === new URL(current).origin;
    } catch {
      return false;
    }
  };

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!isAppOrigin(target)) {
      void shell.openExternal(target);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (target.startsWith("file://")) return; // the welcome screen
    if (!isAppOrigin(target)) {
      event.preventDefault();
      void shell.openExternal(target);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---- IPC: used by the welcome/connect screen (see preload.ts) ----

ipcMain.handle("at:getDashboardUrl", () => storedUrl());

ipcMain.handle("at:testConnection", async (_e, raw: string) => {
  const url = normalizeUrl(raw);
  if (!url) return { ok: false, message: "Enter a valid URL." };
  try {
    // Prefer the API health endpoint if this looks like an API host; otherwise
    // just confirm the page is reachable.
    const res = await fetch(url, { method: "GET", redirect: "manual" as RequestRedirect });
    const reachable = res.status > 0 && res.status < 500;
    return reachable
      ? { ok: true, message: `Reachable (HTTP ${res.status}).` }
      : { ok: false, message: `Server error (HTTP ${res.status}).` };
  } catch (err) {
    return { ok: false, message: `Could not reach it: ${(err as Error).message}` };
  }
});

ipcMain.handle("at:connect", (_e, raw: string) => {
  const url = normalizeUrl(raw);
  if (!url) return { ok: false, message: "Enter a valid URL." };
  try {
    saveUrl(url);
  } catch (err) {
    return { ok: false, message: `Could not save settings: ${(err as Error).message}` };
  }
  loadDashboardOrWelcome();
  return { ok: true, message: "Connected." };
});

ipcMain.handle("at:openExternal", (_e, url: string) => {
  void shell.openExternal(url);
});

function showWelcome(): void {
  if (mainWindow) void mainWindow.loadFile(WELCOME_FILE);
}

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        { label: "Connect to a deployment…", click: showWelcome },
        { type: "separator" },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "AgentTrace Documentation",
          click: () => void shell.openExternal(DOCS_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single-instance: focus the existing window instead of opening a second one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
