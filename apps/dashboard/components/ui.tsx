import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h1 className="font-sans text-lg font-semibold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="stat-label">{label}</div>
      <div className={`mt-1 text-base font-medium ${accent ? "text-verified" : "text-text"}`}>
        {value}
      </div>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-3 flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {item.href ? (
            <Link href={item.href} className="hover:text-text">
              {item.label}
            </Link>
          ) : (
            <span className="text-text">{item.label}</span>
          )}
          {i < items.length - 1 && <span className="text-border">/</span>}
        </span>
      ))}
    </nav>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}
