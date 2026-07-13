import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFirmAccounts, TreasuryAuthError } from "@/lib/treasury";

function money(v: string) {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default async function WalletPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  let accounts: Awaited<ReturnType<typeof getFirmAccounts>> = [];
  let error: string | null = null;

  try {
    accounts = await getFirmAccounts(session.firm.treasury_jwt);
  } catch (err) {
    error = err instanceof TreasuryAuthError
      ? "Treasury token needs reconnecting — see Settings."
      : "Couldn't reach the Treasury API just now.";
  }

  const total = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  if (error) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="ledger-sheet rounded-sm border border-ink-700 p-8">
        <p className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">
          Cash across all accounts
        </p>
        <p className="font-display text-5xl text-ink-900">{money(total.toString())}</p>
      </section>

      {accounts.length === 0 ? (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
          <p className="font-display text-xl italic text-ink-900">No accounts found</p>
        </div>
      ) : (
        <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
          <div className="hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase sm:grid sm:grid-cols-[1.5fr_1fr_1fr]">
            <span>Account</span>
            <span>Type</span>
            <span className="text-right">Balance</span>
          </div>
          <ul>
            {accounts.map((acc) => (
              <li
                key={acc.accountId}
                className="flex flex-col gap-1.5 border-b border-ink-900/10 px-5 py-3.5 last:border-b-0 sm:grid sm:grid-cols-[1.5fr_1fr_1fr] sm:items-center sm:gap-4"
              >
                <p className="text-sm font-medium text-ink-900">
                  {acc.displayName ?? `Account ${acc.accountId}`}
                  {acc.archived && (
                    <span className="ml-2 font-mono text-[0.6875rem] text-ink-700/40">archived</span>
                  )}
                </p>
                <p className="font-mono text-xs text-ink-700/60">{acc.accountType ?? "—"}</p>
                <p className="text-right font-display text-xl text-ink-900">{money(acc.balance)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
