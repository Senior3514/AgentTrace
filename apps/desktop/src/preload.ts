import { contextBridge, ipcRenderer } from "electron";

// Secure bridge between the welcome/connect screen and the main process. No Node
// APIs are exposed to web content — only these explicit, audited calls.
contextBridge.exposeInMainWorld("agenttrace", {
  isDesktop: true,
  platform: process.platform,
  /** The currently configured dashboard URL, or null on first run. */
  getDashboardUrl: (): Promise<string | null> => ipcRenderer.invoke("at:getDashboardUrl"),
  /** Probe a URL for reachability before connecting. */
  testConnection: (url: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("at:testConnection", url),
  /** Persist the URL and load the dashboard in the main window. */
  connect: (url: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("at:connect", url),
  /** Open a link in the system browser. */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("at:openExternal", url),
});
