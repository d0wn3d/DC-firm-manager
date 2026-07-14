import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getLedgerBalances, getOperatorFirm, getReconciliation } from "@/lib/ledger";
import { DepositFlow } from "./DepositFlow";
import { WalletActivity } from "./WalletActivity";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default async function WalletPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const balances = await getLedgerBalances(db, session.firm.id);

  let operatorName = "the operator";
  try {
    operatorName = (await getOperatorFirm(db)).dc_firm_name;
  } catch {
    // Handled below with a clear setup message instead of crashing the page.
  }

  let reconciliation: Awaited<ReturnType<typeof getReconciliation>> | null = null;
  if (session.firm.is_operator) {
    reconciliation = await getReconciliation(db).catch(() => null);
  }

  const { data: deposits } = await db
    .from("deposit_requests")
    .select("*")
    .eq("firm_id", session.firm.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (operatorName === "the operator") {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">Platform wallet isn&apos;t set up yet</p>
        <p className="mt-2 text-sm text-ink-700/70">
          One firm needs <code className="font-mono">is_operator = true</code> and a{" "}
          <code className="font-mono">deposit_account_id</code> — see the note at the top of
          supabase/schema.sql.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
          <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">Operating</p>
          <p className="font-display text-4xl text-moss-500">{money(balances.operating)}</p>
        </div>
        <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
          <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">Savings</p>
          <p className="font-display text-4xl text-ink-900">{money(balances.savings)}</p>
          <p className="mt-1 text-xs text-ink-700/50">0%/mo for now — no locks yet either.</p>
        </div>
      </section>

      <DepositFlow operatorName={operatorName} />

      <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
        <p className="mb-1 font-display text-lg text-ink-900">Move money</p>
        <p className="text-xs text-ink-700/60">
          Withdraw to your Minecraft account, or transfer between Operating and Savings —
          not built yet. Deposits are real; this is next.
        </p>
      </div>

      <WalletActivity deposits={deposits ?? []} />

      {reconciliation && (
        <div
          className={`rounded-sm border p-6 ${
            reconciliation.healthy ? "border-ink-700" : "border-rust-500 bg-rust-600/10"
          }`}
        >
          <p className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/50 uppercase">
            Reserve check (operator only)
          </p>
          <p className="text-sm text-paper-200">
            Everyone&apos;s ledger balances add up to{" "}
            <span className="font-mono">{money(reconciliation.pooledTotal)}</span>, against{" "}
            <span className="font-mono">{money(reconciliation.realBalance)}</span> actually held
            in-game.
          </p>
          {!reconciliation.healthy && (
            <p className="mt-2 font-mono text-xs text-rust-400">
              Pooled balances exceed the real account — something&apos;s wrong, stop and
              investigate before any withdrawals happen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
