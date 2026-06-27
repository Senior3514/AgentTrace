// Compact, observability-style summary tiles. Server component - pure render.

export interface SummaryTile {
  label: string;
  value: number | string;
  accent?: "verified" | "trace" | "warning" | "critical" | "muted";
}

const ACCENT: Record<NonNullable<SummaryTile["accent"]>, string> = {
  verified: "#2EE6A6",
  trace: "#3BA7FF",
  warning: "#F6B84C",
  critical: "#FF5C7A",
  muted: "#93A4B5",
};

export function SummaryStrip({ tiles }: { tiles: SummaryTile[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => {
        const color = t.accent ? ACCENT[t.accent] : "#E8F0F7";
        return (
          <div key={t.label} className="bg-surface px-3 py-2.5">
            <div className="stat-label">{t.label}</div>
            <div className="mt-1 text-lg font-medium tabular-nums" style={{ color }}>
              {t.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
