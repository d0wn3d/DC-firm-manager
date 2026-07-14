"use client";

import { useState, useTransition } from "react";
import { fetchTransactions } from "./actions";
import type { TreasuryAccount, TreasuryTransaction } from "@/lib/treasury";

function money(v: string) {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  const formatted = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function Ledger({
  accounts,
  initialAccountId,
  initialPage,
}: {
  accounts: TreasuryAccount[];
  initialAccountId: number | null;
  initialPage: { page: number; totalPages: number; totalItems: number; items: TreasuryTransaction[] } | null;
}) {
  const [accountId, setAccountId] = useState(initialAccountId);
  const [data, setData] = useState(initialPage);
  const [pending, startTransition] = useTransition();

  function load(nextAccountId: number, page: number) {
    startTransition(async () => {
      const result = await fetchTransactions(nextAccountId, page);
      setAccountId(nextAccountId);
      setData(result);
    });
  }

  if (accounts.length === 0) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">No accounts to show a ledger for</p>
      </div>
    );
  }

  return (
    <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
      <div className="flex flex-wrap gap-1 border-b border-ink-900/10 px-4 py-2.5">
        {accounts.map((acc) => (
          <button
            key={acc.accountId}
            onClick={() => load(acc.accountId, 1)}
            disabled={pending}
            className={`rounded-sm px-3 py-1 font-mono text-xs uppercase tracking-wide transition disabled:opacity-50 ${
              acc.accountId === accountId
                ? "bg-brass-400/20 text-brass-600"
                : "text-ink-700/50 hover:text-ink-900"
            }`}
          >
            {acc.displayName ?? `Account ${acc.accountId}`}
          </button>
        ))}
      </div>

      <div className="hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase sm:grid sm:grid-cols-[1fr_1.6fr_0.9fr_0.9fr]">
        <span>Date</span>
        <span>Memo</span>
        <span>Source</span>
        <span className="text-right">Amount</span>
      </div>

      {!data || data.items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-700/60">
          {pending ? "Loading…" : "No transactions on this account yet."}
        </p>
      ) : (
        <ul className={pending ? "opacity-50" : undefined}>
          {data.items.map((txn) => (
            <li
              key={txn.postingId}
              className="flex flex-col gap-1.5 border-b border-ink-900/10 px-5 py-3 last:border-b-0 sm:grid sm:grid-cols-[1fr_1.6fr_0.9fr_0.9fr] sm:items-center sm:gap-4"
            >
              <p className="font-mono text-xs text-ink-700/70">
                {new Date(txn.settledAt).toLocaleString()}
              </p>
              <p className="text-sm text-ink-900">{txn.memo || txn.message || "—"}</p>
              <p className="font-mono text-[0.6875rem] text-ink-700/50 uppercase">
                {txn.pluginSystem ?? "—"}
              </p>
              <p
                className={`text-right font-display text-lg ${
                  Number(txn.amount) < 0 ? "text-rust-500" : "text-ink-900"
                }`}
              >
                {money(txn.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink-900/10 px-5 py-2.5">
          <button
            onClick={() => accountId !== null && load(accountId, data.page - 1)}
            disabled={pending || data.page <= 1}
            className="font-mono text-xs text-ink-700/60 uppercase disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="font-mono text-[0.6875rem] text-ink-700/50">
            Page {data.page}{" "}
            of {data.totalPages}
          </span>
          <button
            onClick={() => accountId !== null && load(accountId, data.page + 1)}
            disabled={pending || data.page >= data.totalPages}
            className="font-mono text-xs text-ink-700/60 uppercase disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
