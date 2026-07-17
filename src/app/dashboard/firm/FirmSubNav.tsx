"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/firm/overview", label: "Overview" },
  { href: "/dashboard/firm/wallet", label: "Wallet" },
  { href: "/dashboard/firm/employees", label: "Employees" },
  // Points straight at the Journal sub-tab instead of /book, which just
  // redirects there — one less hop, and it sidesteps a redirect-through-Link
  // navigation that was rendering a blank page for a moment before the
  // destination resolved. activeMatch keeps this tab highlighted across all
  // three Book sub-pages, not just Journal specifically.
  { href: "/dashboard/firm/book/journal", activeMatch: "/dashboard/firm/book", label: "Book" },
  { href: "/dashboard/firm/warehouse", label: "Warehouse" },
];

export function FirmSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 border-b border-ink-700/60 pb-3">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.activeMatch ?? tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-sm px-3 py-1 font-mono text-[0.6875rem] tracking-[0.1em] uppercase transition ${
              active
                ? "bg-brass-400/15 text-brass-300"
                : "text-paper-300/50 hover:text-paper-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
