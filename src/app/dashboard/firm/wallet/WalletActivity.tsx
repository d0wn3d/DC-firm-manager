import type { Database } from "@/lib/supabase/types";

type DepositRow = Database["public"]["Tables"]["deposit_requests"]["Row"];

function money(n: number) {
  const formatted = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function WalletActivity({ deposits }: { deposits: DepositRow[] }) {
  // Oldest first to compute a running balance, then reversed for display —
  // this is the whole ledger's activity today (just deposits), and is
  // exactly where a withdrawal or transfer row would slot in once those
  // exist, keyed the same way by matched_at/settled time.
  const chronological = [...deposits]
    .filter((d) => d.status === "matched" && d.matched_at)
    .sort((a, b) => new Date(a.matched_at!).getTime() - new Date(b.matched_at!).getTime());

  const rows = chronological
    .reduce<Array<DepositRow & { balanceAfter: number }>>((acc, d) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].balanceAfter : 0;
      acc.push({ ...d, balanceAfter: previous + (d.credited_amount ?? 0) });
      return acc;
    }, [])
    .reverse();

  return (
    <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
      <p className="border-b border-ink-900/10 px-5 py-3 font-display text-lg text-ink-900">
        Transactions
      </p>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-700/60">
          Nothing yet — a completed deposit will show up here.
        </p>
      ) : (
        <>
          <div className="hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase sm:grid sm:grid-cols-[0.9fr_1.4fr_1fr_0.8fr_0.8fr]">
            <span>Type</span>
            <span>Memo</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Balance</span>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {rows.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-1 border-b border-ink-900/10 px-5 py-3 last:border-b-0 sm:grid sm:grid-cols-[0.9fr_1.4fr_1fr_0.8fr_0.8fr] sm:items-center sm:gap-4"
              >
                <p className="text-sm font-medium text-ink-900">Deposit</p>
                <p className="font-mono text-xs text-ink-700/60">
                  {d.whole_dollar_amount}.{String(d.cents_code).padStart(2, "0")} via /firm pay
                </p>
                <p className="font-mono text-xs text-ink-700/60">
                  {new Date(d.matched_at!).toLocaleString()}
                </p>
                <p className="text-right font-mono text-sm text-moss-500">
                  +{money(d.credited_amount ?? 0)}
                </p>
                <p className="text-right font-mono text-sm text-ink-900">{money(d.balanceAfter)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
