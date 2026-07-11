"use client";

import { useActionState } from "react";
import { updateWebhook, reconnectJwt, type SettingsState } from "./actions";

const initial: SettingsState = { error: null, success: null };

function Feedback({ state }: { state: SettingsState }) {
  if (state.error) {
    return <p className="mt-3 text-xs text-rust-400">{state.error}</p>;
  }
  if (state.success) {
    return <p className="mt-3 text-xs text-moss-400">{state.success}</p>;
  }
  return null;
}

export function WebhookForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, formAction, pending] = useActionState(updateWebhook, initial);

  return (
    <form action={formAction}>
      <input
        name="webhookUrl"
        type="url"
        defaultValue={currentUrl ?? ""}
        placeholder="https://discord.com/api/webhooks/…"
        className="w-full rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 font-mono text-xs text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-sm border border-brass-400/40 px-3 py-1.5 font-mono text-xs tracking-wide text-brass-300 uppercase transition hover:bg-brass-400/10 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ReconnectForm() {
  const [state, formAction, pending] = useActionState(reconnectJwt, initial);

  return (
    <form action={formAction}>
      <textarea
        name="jwt"
        rows={3}
        placeholder="eyJhbGciOi..."
        className="w-full rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 font-mono text-xs text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-sm border border-brass-400/40 px-3 py-1.5 font-mono text-xs tracking-wide text-brass-300 uppercase transition hover:bg-brass-400/10 disabled:opacity-50"
      >
        {pending ? "Verifying…" : "Update token"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
