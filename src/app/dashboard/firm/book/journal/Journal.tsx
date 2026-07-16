"use client";

import { useMemo, useState, useTransition } from "react";
import { tagEntry } from "./actions";
import type { JournalRow } from "@/lib/journal";
import type { ChartAccount } from "@/lib/accounts";
import type { TreasuryAccount } from "@/lib/treasury";

const PAGE_SIZE = 25;
const GRID = "sm:grid sm:grid-cols-[0.9fr_1.3fr_1fr_1.3fr_0.9fr]";

function money(v: string) {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  const formatted = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function CategoryPicker({
  row,
  categories,
  onChange,
}: {
  row: JournalRow;
  categories: ChartAccount[];
  onChange: (categoryId: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={row.categoryId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value || null;
        startTransition(() => onChange(value));
      }}
      aria-label={`Category for ${row.memo || "transaction"} on ${new Date(row.settledAt).toLocaleDateString()}`}
      className={`w-full rounded-sm border bg-paper-100 px-2 py-1 font-mono text-xs focus:outline-none disabled:opacity-50 ${
        row.categoryId ? "border-ink-600/25 text-ink-900" : "border-brass-400/50 text-brass-600"
      }`}
    >
      <option value="">Uncategorized</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} · {c.name}
        </option>
      ))}
    </select>
  );
}

export function Journal({
  initialFeed,
  categories,
  accounts,
}: {
  initialFeed: JournalRow[];
  categories: ChartAccount[];
  accounts: TreasuryAccount[];
}) {
  const [feed, setFeed] = useState(initialFeed);
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return feed.filter((row) => {
      if (accountFilter !== "all" && row.accountId !== accountFilter) return false;
      if (categoryFilter === "uncategorized" && row.categoryId !== null) return false;
      if (categoryFilter !== "all" && categoryFilter !== "uncategorized" && row.categoryId !== categoryFilter) return false;
      return true;
    });
  }, [feed, accountFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const uncategorizedCount = feed.filter((r) => r.categoryId === null).length;

  function handleTag(row: JournalRow, categoryId: string | null) {
    setFeed((prev) =>
      prev.map((r) => (r.accountId === row.accountId && r.postingId === row.postingId ? { ...r, categoryId } : r)),
    );
    tagEntry(row.accountId, row.postingId, categoryId);
  }

  if (accounts.length === 0) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">No Treasury accounts to journal yet</p>
        <p className="mt-2 text-sm text-ink-700/70">
          Once your firm has at least one Treasury account, entries will show up here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uncategorizedCount > 0 && (
        <div className="rounded-sm border border-brass-400/40 bg-brass-400/10 px-4 py-2.5 text-xs text-brass-700">
          {uncategorizedCount} {uncategorizedCount === 1 ? "entry needs" : "entries need"} a category before{" "}
          {uncategorizedCount === 1 ? "it" : "they"}&apos;ll show up in Reports.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={accountFilter}
          onChange={(e) => {
            setAccountFilter(e.target.value === "all" ? "all" : Number(e.target.value));
            setPage(1);
          }}
          className="rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1.5 font-mono text-xs text-ink-900 focus:outline-none"
        >
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.accountId} value={a.accountId}>
              {a.displayName ?? `Account ${a.accountId}`}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1.5 font-mono text-xs text-ink-900 focus:outline-none"
        >
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
        <div
          className={`hidden gap-3 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase ${GRID}`}
        >
          <span>Date</span>
          <span>Memo</span>
          <span>Account</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
        </div>

        {pageRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-700/60">No entries match these filters.</p>
        ) : (
          <ul>
            {pageRows.map((row) => (
              <li
                key={`${row.accountId}-${row.postingId}`}
                className={`flex flex-col gap-1.5 border-b border-ink-900/10 px-5 py-3 last:border-b-0 sm:items-center sm:gap-3 ${GRID}`}
              >
                <p className="font-mono text-xs text-ink-700/70">{new Date(row.settledAt).toLocaleString()}</p>
                <p className="text-sm text-ink-900">{row.memo || "—"}</p>
                <p className="font-mono text-xs text-ink-700/60">{row.accountName}</p>
                <CategoryPicker row={row} categories={categories} onChange={(id) => handleTag(row, id)} />
                <p className={`text-right font-display text-lg ${Number(row.amount) < 0 ? "text-rust-500" : "text-ink-900"}`}>
                  {money(row.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="font-mono text-xs text-paper-300/60 uppercase disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="font-mono text-[0.6875rem] text-paper-300/50">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="font-mono text-xs text-paper-300/60 uppercase disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
