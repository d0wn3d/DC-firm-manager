import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { NavTabs } from "./NavTabs";
import { SyncButton } from "./inventory/SyncButton";
import { SyncedAgo } from "./SyncedAgo";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const { data: lastPoll } = await db
    .from("poll_log")
    .select("polled_at")
    .eq("firm_id", session.firm.id)
    .order("polled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="mb-8 border-b border-ink-700 pb-6">
        <div className="mb-5 flex items-start justify-between">
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <NavTabs />
          <div className="flex items-center gap-3">
            <SyncedAgo iso={lastPoll?.polled_at ?? null} />
            <SyncButton />
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}
