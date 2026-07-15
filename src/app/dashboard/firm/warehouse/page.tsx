import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getWarehouseValuation } from "@/lib/valuation";
import { WarehouseTable } from "./WarehouseTable";
import { AddItemForm } from "./AddItemForm";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default async function WarehousePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const { lines, totalValue, unpricedCount } = await getWarehouseValuation(db, session.firm.id);

  return (
    <div className="space-y-6">
      <section className="ledger-sheet rounded-sm border border-ink-700 p-8">
        <p className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">
          Warehouse value
        </p>
        <p className="font-display text-5xl text-ink-900">{money(totalValue)}</p>
        <p className="mt-2 text-xs text-ink-700/60">
          Every item is priced at the lowest amount {session.firm.dc_firm_name}{" "}
          itself lists it for, unless you&apos;ve set a manual price. No market average — it was
          overvaluing bulk items against thin trade data.
        </p>
        {unpricedCount > 0 && (
          <p className="mt-3 font-mono text-xs text-brass-600">
            {unpricedCount} item{unpricedCount === 1 ? "" : "s"}{" "}
            with no price yet — set one manually to include it in the total.
          </p>
        )}
      </section>

      <WarehouseTable lines={lines} />

      <AddItemForm />
    </div>
  );
}
