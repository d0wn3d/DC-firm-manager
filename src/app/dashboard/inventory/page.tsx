import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ShopTable } from "./ShopTable";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const { data: shops } = await db.from("shops").select("*").eq("firm_id", session.firm.id);
  const all = shops ?? [];

  const emptyCount = all.filter((s) => s.last_alert_state === "empty").length;
  const lowCount = all.filter((s) => s.last_alert_state === "low").length;

  return (
    <>
      <section className="mb-8 flex gap-6">
        <div>
          <p className="font-display text-3xl text-paper-100">{all.length}</p>
          <p className="font-mono text-[0.6875rem] tracking-[0.1em] text-paper-300/50 uppercase">
            Shops tracked
          </p>
        </div>
        <div>
          <p className="font-display text-3xl text-rust-400">{emptyCount}</p>
          <p className="font-mono text-[0.6875rem] tracking-[0.1em] text-paper-300/50 uppercase">
            Empty
          </p>
        </div>
        <div>
          <p className="font-display text-3xl text-brass-400">{lowCount}</p>
          <p className="font-mono text-[0.6875rem] tracking-[0.1em] text-paper-300/50 uppercase">
            Low stock
          </p>
        </div>
      </section>

      {all.length === 0 ? (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
          <p className="font-display text-xl italic text-ink-900">No shops found yet</p>
          <p className="mt-2 text-sm text-ink-700/70">
            Set up a ChestShop tagged to{" "}
            {session.firm.dc_firm_name}{" "}
            in-game, then hit sync — or if you just connected, give the first
            sync a moment and refresh.
          </p>
        </div>
      ) : (
        <ShopTable shops={all} />
      )}
    </>
  );
}
