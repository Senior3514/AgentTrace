import { contextBridge } from "electron";

// Minimal, safe bridge. No Node APIs are exposed to the dashboard; this only
// advertises that it is running inside the desktop shell.
contextBridge.exposeInMainWorld("agenttraceDesktop", {
  isDesktop: true,
  platform: process.platform,
});
