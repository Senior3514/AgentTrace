import type { ReactNode } from "react";

function Chip({
  children,
  color,
  title,
}: {
  children: ReactNode;
  color: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

const RISK_COLORS: Record<string, string> = {
  NONE: "#93A4B5",
  LOW: "#3BA7FF",
  MEDIUM: "#F6B84C",
  HIGH: "#FF5C7A",
  CRITICAL: "#FF5C7A",
  INFO: "#93A4B5",
};

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "#3BA7FF",
  FINALIZED: "#2EE6A6",
  FAILED: "#FF5C7A",
  ABORTED: "#F6B84C",
};

const ACTION_COLORS: Record<string, string> = {
  READ: "#93A4B5",
  WRITE: "#F6B84C",
  EXTERNAL_CALL: "#F6B84C",
  CODE_EXECUTION: "#3BA7FF",
  SECRET_ACCESS: "#FF5C7A",
  APPROVAL: "#2EE6A6",
  CONTROL: "#93A4B5",
  OTHER: "#93A4B5",
};

export function RiskChip({ level }: { level: string | null | undefined }) {
  const value = (level ?? "NONE").toUpperCase();
  return <Chip color={RISK_COLORS[value] ?? "#93A4B5"}>{value}</Chip>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Chip color={STATUS_COLORS[status] ?? "#93A4B5"}>{status}</Chip>;
}

export function ActionClassBadge({ actionClass }: { actionClass: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-2xs font-medium"
      style={{
        color: ACTION_COLORS[actionClass] ?? "#93A4B5",
        backgroundColor: `${ACTION_COLORS[actionClass] ?? "#93A4B5"}14`,
      }}
    >
      {actionClass}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string }) {
  const color = RISK_COLORS[severity.toUpperCase()] ?? "#93A4B5";
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}
