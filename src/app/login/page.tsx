"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-3 font-mono text-[0.6875rem] tracking-[0.25em] text-brass-400 uppercase">
            Treasury API · Live Ledger
          </p>
          <h1 className="font-display text-5xl italic text-paper-100">Stockbook</h1>
          <p className="mt-4 text-sm leading-relaxed text-paper-300/70">
            Live chest shop stock, low-inventory alerts, and firm ledgers for
            DemocracyCraft businesses.
          </p>
        </div>

        <div className="ledger-sheet rounded-sm border border-ink-700 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
          <p className="mb-4 font-mono text-[0.6875rem] tracking-[0.15em] text-ink-700/70 uppercase">
            Sign in to continue
          </p>
          <button
            onClick={signIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-sm bg-[#5865F2] px-4 py-3 font-body text-sm font-semibold text-white transition hover:bg-[#4752C4] disabled:opacity-60"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-white/90" />
            {loading ? "Redirecting…" : "Continue with Discord"}
          </button>
          {error && (
            <p className="mt-3 font-mono text-xs text-rust-600">{error}</p>
          )}
          <p className="mt-4 text-center text-xs text-ink-700/60">
            You&apos;ll connect your firm&apos;s Treasury key after signing in.
          </p>
        </div>
      </div>
    </main>
  );
}
