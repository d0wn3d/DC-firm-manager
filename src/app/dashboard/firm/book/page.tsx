import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const SOURCE_LABEL: Record<string, string> = {
  market_24h: "24h market avg",
  own_shops_fallback: "your listed price",
  unavailable: "no price data",
};

export default async function FirmPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const { data: valuations } = await db
    .from("item_valuations")
    .select("*")
    .eq("firm_id", session.firm.id)
    .order("total_value", { ascending: false });

  const lines = valuations ?? [];
  const totalValue = lines.reduce((sum, l) => sum + l.total_value, 0);
  const unpriced = lines.filter((l) => l.value_source === "unavailable" && l.total_quantity > 0);

  return (
    <div className="space-y-8">
      <section className="ledger-sheet rounded-sm border border-ink-700 p-8">
        <p className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/60 uppercase">
          Inventory valuation
        </p>
        <p className="font-display text-5xl text-ink-900">{money(totalValue)}</p>
        <p className="mt-2 text-xs text-ink-700/60">
          Priced at each item&apos;s 24h market average where one exists, otherwise the
          cheapest price{" "}
          {session.firm.dc_firm_name}{" "}
          itself lists across its own shops. Updates on every sync — cash
          balances aren&apos;t included here yet.
        </p>
        {unpriced.length > 0 && (
          <p className="mt-3 font-mono text-xs text-brass-600">
            {unpriced.length} item{unpriced.length === 1 ? "" : "s"} held with no price
            anywhere to value against — excluded from the total.
          </p>
        )}
      </section>

      {lines.length === 0 ? (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
          <p className="font-display text-xl italic text-ink-900">Nothing valued yet</p>
          <p className="mt-2 text-sm text-ink-700/70">
            Valuation is computed alongside inventory sync — hit &quot;Sync now&quot; above
            once you&apos;ve got shops connected.
          </p>
        </div>
      ) : (
        <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
          <div className="hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase sm:grid sm:grid-cols-[1.3fr_0.8fr_0.9fr_1fr_0.9fr]">
            <span>Item</span>
            <span className="text-right">Quantity</span>
            <span className="text-right">Unit value</span>
            <span className="text-right">Priced by</span>
            <span className="text-right">Line value</span>
          </div>
          <ul>
            {lines.map((line) => (
              <li
                key={line.item_key}
                className="flex flex-col gap-1.5 border-b border-ink-900/10 px-5 py-3 last:border-b-0 sm:grid sm:grid-cols-[1.3fr_0.8fr_0.9fr_1fr_0.9fr] sm:items-center sm:gap-4"
              >
                <p className="text-sm font-medium text-ink-900">
                  {line.item_name ?? line.item_key}
                </p>
                <p className="text-right font-mono text-sm text-ink-900 sm:text-right">
                  {line.total_quantity}
                </p>
                <p className="text-right font-mono text-xs text-ink-700/70">
                  {line.unit_value !== null ? money(line.unit_value) : "—"}
                </p>
                <p className="text-right font-mono text-[0.6875rem] text-ink-700/50">
                  {SOURCE_LABEL[line.value_source]}
                </p>
                <p className="text-right font-display text-lg text-ink-900">
                  {money(line.total_value)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
