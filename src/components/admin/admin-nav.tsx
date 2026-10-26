"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_NAV = [
  { href: "/admin/menu", label: "Меню" },
  { href: "/admin/tables", label: "Столы и QR" },
  { href: "/admin/staff", label: "Персонал" },
  { href: "/admin/settings", label: "Настройки" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {ADMIN_NAV.map((n) => {
        const active = path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href}
            className={`flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold ${active ? "bg-text text-bg" : "border border-line bg-surface text-muted"}`}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
