import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Wordmark } from "../components/Wordmark";
import { NavLink } from "../components/NavLink";
import { ApiStatus } from "../components/ApiStatus";

export const metadata: Metadata = {
  title: "AgentTrace - execution evidence for AI agents",
  description:
    "AgentTrace records runtime events, binds them to policy and approval context, and generates signed receipts for finalized agent runs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-text font-body">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-6 px-5">
            <Link href="/">
              <Wordmark />
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink href="/runs">Runs</NavLink>
              <NavLink href="/agents">Agents</NavLink>
              <NavLink href="/verify">Verify</NavLink>
            </nav>
            <div className="ml-auto flex items-center gap-3 text-2xs uppercase tracking-wider text-muted">
              <span className="hidden lg:inline">Execution Evidence Layer</span>
              <ApiStatus />
              <span className="rounded border border-border px-1.5 py-0.5">v0</span>
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-6.5rem)] max-w-[1400px] px-5 py-6">
          {children}
        </main>
        <footer className="mx-auto max-w-[1400px] px-5 py-4 text-2xs text-muted">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
            <span>AgentTrace - execution evidence layer for AI agents</span>
            <span className="hidden sm:inline">·</span>
            <span>deterministic receipts · Ed25519 signatures · tamper-evident</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
