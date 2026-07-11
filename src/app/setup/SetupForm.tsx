"use client";

import { useActionState } from "react";
import { connectFirm, type ConnectFirmState } from "./actions";

const initialState: ConnectFirmState = { error: null };

export function SetupForm() {
  const [state, formAction, pending] = useActionState(connectFirm, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
        <label className="mb-2 block font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/70 uppercase">
          Treasury JWT
        </label>
        <textarea
          name="jwt"
          required
          rows={4}
          placeholder="eyJhbGciOi..."
          className="w-full rounded-sm border border-ink-600/30 bg-paper-100 px-3 py-2 font-mono text-xs text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
        />
        <p className="mt-3 text-xs leading-relaxed text-ink-700/70">
          In-game, run{" "}
          <code className="rounded-sm bg-ink-900/10 px-1 py-0.5 font-mono text-ink-900">
            /treasuryapi business issue
          </code>{" "}
          for the firm you want to track, then paste the token here. It&apos;s
          stored server-side only and never sent to your browser again.
        </p>
      </div>

      <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
        <label className="mb-2 block font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/70 uppercase">
          Discord webhook <span className="normal-case text-ink-700/50">(optional)</span>
        </label>
        <input
          name="webhookUrl"
          type="url"
          placeholder="https://discord.com/api/webhooks/…"
          className="w-full rounded-sm border border-ink-600/30 bg-paper-100 px-3 py-2 font-mono text-xs text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
        />
        <p className="mt-3 text-xs leading-relaxed text-ink-700/70">
          Where low-stock and out-of-stock alerts get posted. In Discord:
          channel settings → Integrations → Webhooks → New Webhook → Copy
          URL. Skip this for now and add it later from Settings.
        </p>
      </div>

      {state.error && (
        <p className="rounded-sm border border-rust-500/40 bg-rust-600/10 px-4 py-3 text-sm text-rust-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-brass-400 px-4 py-3 font-body text-sm font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-60"
      >
        {pending ? "Verifying with the Treasury…" : "Connect firm"}
      </button>
    </form>
  );
}
