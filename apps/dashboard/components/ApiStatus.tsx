"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_AGENTTRACE_API_URL ?? "http://localhost:4000";

type State = "checking" | "online" | "offline";

const DOT: Record<State, string> = {
  checking: "#93A4B5",
  online: "#2EE6A6",
  offline: "#FF5C7A",
};

/**
 * Live API reachability indicator. Useful when the dashboard and API are
 * deployed as separate Vercel projects - confirms cross-origin connectivity.
 */
export function ApiStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    const ping = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        if (active) setState(res.ok ? "online" : "offline");
      } catch {
        if (active) setState("offline");
      }
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const label = state === "checking" ? "API…" : state === "online" ? "API online" : "API offline";

  return (
    <span
      title={`AgentTrace API · ${API_BASE}`}
      className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5"
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: DOT[state], boxShadow: `0 0 6px ${DOT[state]}` }}
      />
      {label}
    </span>
  );
}
