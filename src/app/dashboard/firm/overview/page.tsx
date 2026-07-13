import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmAccounts, getFirmEmployees } from "@/lib/treasury";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function Stat({ label, value, href, tone = "default" }: { label: string; value: string; href: string; tone?: "default" | "warn" }) {
  return (
    <Link
      href={href}
      className="ledger-sheet block rounded-sm border border-ink-700 p-6 transition hover:border-brass-500/50"
    >
      <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">{label}</p>
      <p className={`font-display text-3xl ${tone === "warn" ? "text-rust-500" : "text-ink-900"}`}>
        {value}
      </p>
    </Link>
  );
}

export default async function OverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();

  const [{ data: valuations }, { data: shops }, accountsResult, employeesResult] = await Promise.all([
    db.from("item_valuations").select("total_value").eq("firm_id", session.firm.id),
    db.from("shops").select("last_alert_state").eq("firm_id", session.firm.id),
    getFirmAccounts(session.firm.treasury_jwt).catch(() => null),
    getFirmEmployees(session.firm.treasury_jwt).catch(() => null),
  ]);

  const inventoryValue = (valuations ?? []).reduce((sum, v) => sum + v.total_value, 0);
  const cashTotal = accountsResult?.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) ?? null;
  const needsAttention = (shops ?? []).filter((s) => s.last_alert_state !== "ok").length;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Stat label="Cash on hand" value={cashTotal !== null ? money(cashTotal) : "—"} href="/dashboard/firm/wallet" />
      <Stat label="Inventory value" value={money(inventoryValue)} href="/dashboard/firm/book" />
      <Stat
        label="Shops needing attention"
        value={String(needsAttention)}
        href="/dashboard/inventory"
        tone={needsAttention > 0 ? "warn" : "default"}
      />
      <Stat
        label="Employees"
        value={employeesResult !== null ? String(employeesResult.length) : "—"}
        href="/dashboard/firm/employees"
      />
      {cashTotal !== null && (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-6 sm:col-span-2">
          <p className="font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">
            Total net worth
          </p>
          <p className="font-display text-4xl text-ink-900">{money(cashTotal + inventoryValue)}</p>
          <p className="mt-1 text-xs text-ink-700/60">Cash on hand plus inventory value.</p>
        </div>
      )}
    </div>
  );
}
