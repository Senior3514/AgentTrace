// Runtime configuration, read once from the environment.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Best-effort load of a repo-root .env for local dev. In containers the
// environment is injected directly, so a missing file is fine.
function loadDotEnv(): void {
  if (typeof process.loadEnvFile !== "function") return;
  for (const candidate of [".env", "../.env", "../../.env", "../../../.env"]) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) {
      try {
        process.loadEnvFile(path);
      } catch {
        /* ignore malformed env file */
      }
      return;
    }
  }
}

loadDotEnv();

function parseKeys(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export interface AppConfig {
  host: string;
  port: number;
  apiKeys: string[];
  signingKey: string | undefined;
  publicKey: string | undefined;
}

export function loadConfig(): AppConfig {
  return {
    host: process.env.API_HOST ?? "0.0.0.0",
    port: Number(process.env.API_PORT ?? 4000),
    apiKeys: parseKeys(process.env.API_KEYS ?? "dev_key_local"),
    signingKey: process.env.RECEIPT_SIGNING_KEY || undefined,
    publicKey: process.env.RECEIPT_PUBLIC_KEY || undefined,
  };
}

export const config = loadConfig();
