import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ShopTable } from "./ShopTable";
import { SyncButton } from "./SyncButton";
import { signOut } from "./actions";

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();

  const [{ data: shops }, { data: lastPoll }] = await Promise.all([
    db.from("shops").select("*").eq("firm_id", session.firm.id),
    db
      .from("poll_log")
      .select("*")
      .eq("firm_id", session.firm.id)
      .order("polled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const severity = { empty: 0, low: 1, ok: 2 } as const;
  const sorted = [...(shops ?? [])].sort((a, b) => {
    const sevDiff = severity[a.last_alert_state] - severity[b.last_alert_state];
    if (sevDiff !== 0) return sevDiff;
    return (a.item_name ?? a.item_key).localeCompare(b.item_name ?? b.item_key);
  });

  const emptyCount = sorted.filter((s) => s.last_alert_state === "empty").length;
  const lowCount = sorted.filter((s) => s.last_alert_state === "low").length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between border-b border-ink-700 pb-6">
        <div>
          <p className="font-mono text-[0.6875rem] tracking-[0.25em] text-brass-400 uppercase">
            Registry No. {session.firm.dc_firm_id}
          </p>
          <h1 className="font-display text-4xl italic text-paper-100">
            {session.firm.dc_firm_name}
          </h1>
          {session.firm.jwt_invalid && (
            <p className="mt-2 font-mono text-xs text-rust-400">
              Treasury token expired —{" "}
              <Link href="/settings" className="underline underline-offset-2">
                reconnect in Settings
              </Link>{" "}
              to resume syncing.
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-paper-300/70">
          <span>{session.discordName}</span>
          <Link href="/settings" className="hover:text-paper-100">
            Settings
          </Link>
          <form action={signOut}>
            <button className="hover:text-paper-100">Sign out</button>
          </form>
        </div>
      </header>

      <section className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-6">
          <div>
            <p className="font-display text-3xl text-paper-100">{sorted.length}</p>
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
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-paper-300/50">
            Synced {timeAgo(lastPoll?.polled_at ?? null)}
          </span>
          <SyncButton />
        </div>
      </section>

      {sorted.length === 0 ? (
        <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
          <p className="font-display text-xl italic text-ink-900">
            No shops found yet
          </p>
          <p className="mt-2 text-sm text-ink-700/70">
            Set up a ChestShop tagged to {session.firm.dc_firm_name} in-game,
            then hit sync — or if you just connected, give the first sync a
            moment and refresh.
          </p>
        </div>
      ) : (
        <ShopTable shops={sorted} />
      )}
    </main>
  );
}
