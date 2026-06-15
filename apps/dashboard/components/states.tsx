import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="h-8 w-8 rounded border border-border bg-surface-2" />
      <h3 className="text-sm font-medium text-text">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="panel border-critical/40 px-6 py-10 text-center">
      <h3 className="text-sm font-medium text-critical">{title}</h3>
      {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
      <p className="mt-4 text-2xs uppercase tracking-wide text-muted">
        Start the API with <span className="mono text-trace">pnpm dev:api</span>
      </p>
    </div>
  );
}
