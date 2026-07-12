import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { WebhookForm, ReconnectForm } from "./SettingsForms";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
      <Link
        href="/dashboard/inventory"
        className="mb-8 inline-block font-mono text-xs tracking-wide text-paper-300/60 uppercase hover:text-paper-100"
      >
        ← Back to ledger
      </Link>

      <h1 className="mb-1 font-display text-4xl italic text-paper-100">Settings</h1>
      <p className="mb-8 text-sm text-paper-300/70">
        {session.firm.dc_firm_name} · Registry No. {session.firm.dc_firm_id}
      </p>

      <div className="space-y-6">
        <section className="ledger-sheet rounded-sm border border-ink-700 p-6">
          <h2 className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/70 uppercase">
            Discord alerts
          </h2>
          <p className="mb-4 text-xs text-ink-700/60">
            Posted here whenever a shop crosses its low-stock threshold or
            runs out.
          </p>
          <WebhookForm currentUrl={session.firm.discord_webhook_url} />
        </section>

        <section className="ledger-sheet rounded-sm border border-ink-700 p-6">
          <h2 className="mb-1 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/70 uppercase">
            Treasury token
          </h2>
          <p className="mb-4 text-xs text-ink-700/60">
            {session.firm.jwt_invalid ? (
              <span className="text-rust-500">
                Expired or revoked — syncing is paused until you replace it.
              </span>
            ) : session.firm.treasury_jwt_expires_at ? (
              <>
                Rotates automatically about a day before it expires (currently
                good until{" "}
                {new Date(session.firm.treasury_jwt_expires_at).toLocaleString()}
                ). Only replace it manually if syncing stops working.
              </>
            ) : (
              "Re-issue and paste a fresh token if you rotate it in-game."
            )}
          </p>
          <ReconnectForm />
        </section>
      </div>
    </main>
  );
}
