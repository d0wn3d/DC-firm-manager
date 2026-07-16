"use client";

import { useState, useTransition } from "react";
import { fetchReport } from "./actions";
import type { ProfitAndLoss } from "@/lib/reports";

type RangeKey = "this_month" | "last_month" | "this_quarter" | "ytd";

const RANGE_LABELS: Record<RangeKey, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  ytd: "Year to date",
};

function money(n: number) {
  const formatted = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function rangeFor(key: RangeKey): [Date, Date] {
  const now = new Date();
  switch (key) {
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return [start, end];
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return [new Date(now.getFullYear(), quarterStartMonth, 1), now];
    }
    case "ytd":
      return [new Date(now.getFullYear(), 0, 1), now];
    default:
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  }
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-900">{label}</span>
        <span className="shrink-0 font-mono text-sm text-ink-900">{money(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/8">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Reports({
  initialReport,
  hasAccounts,
  snapshot,
}: {
  initialReport: ProfitAndLoss | null;
  hasAccounts: boolean;
  snapshot: { cash: number; inventory: number };
}) {
  const [range, setRange] = useState<RangeKey>("this_month");
  const [report, setReport] = useState(initialReport);
  const [pending, startTransition] = useTransition();

  function changeRange(key: RangeKey) {
    setRange(key);
    const [start, end] = rangeFor(key);
    startTransition(async () => {
      const result = await fetchReport(start.toISOString(), end.toISOString());
      setReport(result);
    });
  }

  if (!hasAccounts) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">No Treasury accounts to report on yet</p>
      </div>
    );
  }

  const maxLine = report
    ? Math.max(1, ...report.income.map((l) => l.total), ...report.expense.map((l) => l.total))
    : 1;

  return (
    <div className="space-y-5">
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

      <section className="ledger-sheet rounded-sm border border-ink-700 p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">Balance snapshot</p>
          <p className="font-mono text-[0.6875rem] text-ink-700/40">as of today</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-display text-2xl text-ink-900">{money(snapshot.cash)}</p>
            <p className="font-mono text-[0.6875rem] text-ink-700/50 uppercase">Cash</p>
          </div>
          <div>
            <p className="font-display text-2xl text-ink-900">{money(snapshot.inventory)}</p>
            <p className="font-mono text-[0.6875rem] text-ink-700/50 uppercase">Inventory</p>
          </div>
          <div>
            <p className="font-display text-2xl text-brass-600">{money(snapshot.cash + snapshot.inventory)}</p>
            <p className="font-mono text-[0.6875rem] text-ink-700/50 uppercase">Total assets</p>
          </div>
        </div>
      </section>

      {!report || pending ? (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
          <p className="text-sm text-ink-700/60">{pending ? "Recalculating…" : "No data for this range."}</p>
        </div>
      ) : (
        <>
          <section className="ledger-sheet rounded-sm border border-ink-700 p-8">
            <p className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">Net income</p>
            <p className={`font-display text-5xl ${report.net >= 0 ? "text-moss-500" : "text-rust-500"}`}>
              {money(report.net)}
            </p>
            <p className="mt-2 text-xs text-ink-700/60">
              {money(report.totalIncome)} in income, {money(report.totalExpense)} in expense —{" "}
              {RANGE_LABELS[range].toLowerCase()}.
            </p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="ledger-sheet rounded-sm border border-ink-700 p-6">
              <p className="mb-3 font-mono text-[0.6875rem] tracking-[0.15em] text-moss-500 uppercase">Income</p>
              {report.income.length === 0 ? (
                <p className="text-sm text-ink-700/50">No categorized income this range.</p>
              ) : (
                report.income.map((line) => (
                  <Bar key={line.categoryId} label={line.name} value={line.total} max={maxLine} tone="bg-moss-400" />
                ))
              )}
            </section>
            <section className="ledger-sheet rounded-sm border border-ink-700 p-6">
              <p className="mb-3 font-mono text-[0.6875rem] tracking-[0.15em] text-rust-500 uppercase">Expense</p>
              {report.expense.length === 0 ? (
                <p className="text-sm text-ink-700/50">No categorized expense this range.</p>
              ) : (
                report.expense.map((line) => (
                  <Bar key={line.categoryId} label={line.name} value={line.total} max={maxLine} tone="bg-rust-400" />
                ))
              )}
            </section>
          </div>

          {report.uncategorizedCount > 0 && (
            <div className="rounded-sm border border-brass-400/40 bg-brass-400/10 px-4 py-3 text-xs text-brass-700">
              {report.uncategorizedCount} uncategorized {report.uncategorizedCount === 1 ? "entry" : "entries"} (
              {money(report.uncategorizedTotal)}) excluded from this report —{" "}
              <a href="/dashboard/firm/book/journal" className="underline underline-offset-2">
                tag them in the Journal
              </a>
              .
            </div>
          )}
        </>
      )}
    </div>
  );
}
