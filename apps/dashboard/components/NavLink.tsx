"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
