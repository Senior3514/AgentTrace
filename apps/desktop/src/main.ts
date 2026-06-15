import {
  app,
  BrowserWindow,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// AgentTrace desktop shell: a security-hardened Electron window around the
// dashboard. The dashboard itself stays a pure web app; this just frames it as
// a native desktop application.

const DEFAULT_URL = process.env.AGENTTRACE_DASHBOARD_URL ?? "http://localhost:3000";
const DOCS_URL = "https://github.com/Senior3514/AgentTrace/blob/main/docs/deploy-vercel.md";

let mainWindow: BrowserWindow | null = null;

function configPath(): string {
  return join(app.getPath("userData"), "config.json");
}

/** Resolve the dashboard URL: persisted config → env/default. */
function dashboardUrl(): string {
  try {
    if (existsSync(configPath())) {
      const cfg = JSON.parse(readFileSync(configPath(), "utf8")) as { dashboardUrl?: string };
      if (cfg.dashboardUrl) return cfg.dashboardUrl;
    }
  } catch {
    /* fall through to default */
  }
  return DEFAULT_URL;
}

function ensureConfig(): void {
  if (!existsSync(configPath())) {
    try {
      writeFileSync(configPath(), JSON.stringify({ dashboardUrl: DEFAULT_URL }, null, 2));
    } catch {
      /* best effort */
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0A0D10",
    title: "AgentTrace",
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = dashboardUrl();
  void mainWindow.loadURL(url);

  // Open external origins (e.g. GitHub, the API host) in the system browser
  // rather than inside the app shell.
  const isAppOrigin = (target: string) => {
    try {
      return new URL(target).origin === new URL(dashboardUrl()).origin;
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
    if (!isAppOrigin(target)) {
      event.preventDefault();
      void shell.openExternal(target);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Edit Dashboard URL…",
          click: () => {
            ensureConfig();
            void shell.openPath(configPath());
          },
        },
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
          click: () => {
            void shell.openExternal(DOCS_URL);
          },
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
