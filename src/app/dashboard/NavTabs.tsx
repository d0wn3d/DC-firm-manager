"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/firm", label: "Firm" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-sm px-3 py-1.5 font-mono text-xs tracking-wide uppercase transition ${
              active
                ? "bg-brass-400/15 text-brass-300"
                : "text-paper-300/60 hover:text-paper-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
