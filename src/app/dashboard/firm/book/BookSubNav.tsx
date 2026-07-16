"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/firm/book/journal", label: "Journal" },
  { href: "/dashboard/firm/book/chart-of-accounts", label: "Chart of accounts" },
  { href: "/dashboard/firm/book/reports", label: "Reports" },
];

export function BookSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex gap-1">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-sm px-3 py-1 font-mono text-[0.6875rem] tracking-[0.1em] uppercase transition ${
              active ? "bg-brass-400/15 text-brass-300" : "text-paper-300/50 hover:text-paper-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
