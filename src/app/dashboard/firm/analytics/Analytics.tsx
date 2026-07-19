"use client";

import { useState, useTransition } from "react";
import { fetchKPIs } from "./actions";
import type { BusinessKPIs } from "@/lib/analytics";

type RangeKey = "this_month" | "this_quarter" | "this_year" | "lifetime";

const RANGE_LABELS: Record<RangeKey, string> = {
  this_month: "This month",
  this_quarter: "This quarter",
  this_year: "This year",
  lifetime: "Lifetime",
};

function money(n: number) {
  const formatted = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function pct(n: number | null, digits = 1) {
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

function ratio(n: number | null) {
  return n === null ? "—" : n.toFixed(2);
}

function num(n: number | null) {
  return n === null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface Range {
  current: [Date, Date];
  previous: [Date, Date] | null;
}

function rangeFor(key: RangeKey): Range {
  const now = new Date();
  switch (key) {
    case "this_quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qStartMonth, 1);
      const prevStart = new Date(now.getFullYear(), qStartMonth - 3, 1);
      const prevEnd = new Date(now.getFullYear(), qStartMonth, 0, 23, 59, 59, 999);
      return { current: [start, now], previous: [prevStart, prevEnd] };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const prevStart = new Date(now.getFullYear() - 1, 0, 1);
      const prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { current: [start, now], previous: [prevStart, prevEnd] };
    }
    case "lifetime":
      // Same bounded-fetch-window caveat as Reports' Lifetime range.
      return { current: [new Date(2020, 0, 1), now], previous: null };
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { current: [start, now], previous: [prevStart, prevEnd] };
    }
  }
}

function KPICard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="ledger-sheet rounded-sm border border-ink-700 p-5">
      <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone ?? "text-ink-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-700/50">{hint}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 font-mono text-[0.6875rem] tracking-[0.15em] text-paper-300/60 uppercase">{children}</p>;
}

export function Analytics({ initialKPIs, hasAccounts }: { initialKPIs: BusinessKPIs | null; hasAccounts: boolean }) {
  const [range, setRange] = useState<RangeKey>("this_month");
  const [kpis, setKpis] = useState(initialKPIs);
  const [pending, startTransition] = useTransition();

  function changeRange(key: RangeKey) {
    setRange(key);
    const { current, previous } = rangeFor(key);
    startTransition(async () => {
      const result = await fetchKPIs(
        current[0].toISOString(),
        current[1].toISOString(),
        previous ? previous[0].toISOString() : null,
        previous ? previous[1].toISOString() : null,
      );
      setKpis(result);
    });
  }

  if (!hasAccounts) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">No Treasury accounts to analyze yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => changeRange(key)}
            className={`rounded-sm px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
              range === key ? "bg-brass-400/15 text-brass-300" : "text-paper-300/50 hover:text-paper-100"
            }`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {!kpis || pending ? (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
          <p className="text-sm text-ink-700/60">{pending ? "Recalculating…" : "No data for this range."}</p>
        </div>
      ) : (
        <>
          <section>
            <SectionLabel>Profit &amp; loss — {RANGE_LABELS[range].toLowerCase()}</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard label="Revenue" value={money(kpis.totalRevenue)} />
              <KPICard label="Expense" value={money(kpis.totalExpense)} />
              <KPICard
                label="Net income"
                value={money(kpis.netIncome)}
                tone={kpis.netIncome >= 0 ? "text-moss-500" : "text-rust-500"}
              />
              <KPICard label="Profit margin" value={pct(kpis.profitMargin)} hint="Net income ÷ revenue" />
            </div>
          </section>

          <section>
            <SectionLabel>Customers — {RANGE_LABELS[range].toLowerCase()}</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                label="New vs returning"
                value={`${num(kpis.newCustomers)} / ${num(kpis.returningCustomers)}`}
                hint="Buyers this period, new / returning"
              />
              <KPICard label="New customer rate" value={pct(kpis.newCustomerRate)} />
              <KPICard label="ARPU" value={kpis.arpu === null ? "—" : money(kpis.arpu)} hint="Revenue ÷ distinct buyers" />
              <KPICard
                label="Avg. transaction value"
                value={kpis.averageTransactionValue === null ? "—" : money(kpis.averageTransactionValue)}
              />
            </div>
          </section>

          <section>
            <SectionLabel>Growth &amp; efficiency</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                label="Revenue growth"
                value={pct(kpis.revenueGrowthRate)}
                hint={range === "lifetime" ? "No prior period for Lifetime" : "Vs. the previous period"}
              />
              <KPICard label="Expense ratio" value={pct(kpis.expenseRatio)} hint="Expense ÷ revenue" />
              <KPICard
                label="Revenue / employee"
                value={kpis.revenuePerEmployee === null ? "—" : money(kpis.revenuePerEmployee)}
                hint={kpis.employeeCount === null ? "Employee count unavailable" : `${kpis.employeeCount} employees`}
              />
              <KPICard
                label="Debt-to-equity"
                value={ratio(kpis.debtToEquity)}
                hint={`As of ${new Date(kpis.rangeEnd).toLocaleDateString()} — a balance, not a ${RANGE_LABELS[range].toLowerCase()} total`}
              />
            </div>
          </section>

          <section className="ledger-sheet rounded-sm border border-ink-700 p-6">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">
                Multi-item repeat rate
              </p>
              <p className="font-display text-xl text-ink-900">{pct(kpis.multiItemRepeatRate)}</p>
            </div>
            <p className="text-xs leading-relaxed text-ink-700/60">
              Closest honest stand-in for an upsell/cross-sell rate: the share of returning buyers this period who
              purchased more than one distinct item. A true upsell rate needs product tiers or bundles Stockbook
              doesn&apos;t track yet, so treat this as breadth-of-purchase, not upgrade behavior.
            </p>
            {kpis.attributedTransactionCount === 0 && (
              <p className="mt-2 text-xs text-brass-600">
                No transactions could be matched to a buyer yet in the current window — customer and item figures
                above will read as zero until that changes.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
