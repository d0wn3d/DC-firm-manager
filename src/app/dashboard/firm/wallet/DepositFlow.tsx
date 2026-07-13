"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startDeposit, checkDeposit, cancelDeposit } from "./actions";

type Stage =
  | { step: "idle" }
  | { step: "active"; id: string; command: string; checking: boolean; message: string | null };

export function DepositFlow({ operatorName }: { operatorName: string }) {
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function begin() {
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Enter a whole dollar amount greater than zero.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await startDeposit(parsed);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Couldn't start a deposit.");
        return;
      }
      setStage({ step: "active", id: result.data.id, command: result.data.command, checking: false, message: null });
    });
  }

  function check() {
    if (stage.step !== "active") return;
    const { id } = stage;
    setStage({ ...stage, checking: true });
    startTransition(async () => {
      const result = await checkDeposit(id);
      if (!result.ok) {
        setStage((s) => (s.step === "active" ? { ...s, checking: false, message: result.error ?? "Error" } : s));
        return;
      }
      setStage((s) => (s.step === "active" ? { ...s, checking: false, message: result.data!.message } : s));
      if (result.data?.matched) {
        router.refresh();
      }
    });
  }

  function cancel() {
    if (stage.step !== "active") return;
    const { id } = stage;
    startTransition(async () => {
      await cancelDeposit(id);
      setStage({ step: "idle" });
      setAmount("");
    });
  }

  if (stage.step === "idle") {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
        <p className="mb-1 font-display text-lg text-ink-900">Add funds</p>
        <p className="mb-4 text-xs text-ink-700/60">
          Pay {operatorName} in-game. Every deposit gets a personal cents code — pay the exact
          amount shown, including the cents, and you&apos;re credited the full amount you send.
        </p>
        <label className="mb-1 block font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase">
          Amount (whole dollars)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
            className="w-full rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 font-mono text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
          />
          <button
            onClick={begin}
            disabled={pending}
            className="whitespace-nowrap rounded-sm bg-ink-900 px-4 py-2 font-body text-sm font-semibold text-paper-100 transition hover:bg-ink-800 disabled:opacity-50"
          >
            {pending ? "…" : "Get code"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rust-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
      <p className="mb-1 font-display text-lg text-ink-900">Send this exact command</p>
      <p className="mb-3 text-xs text-ink-700/60">
        The cents are your code for this deposit — a different one every time. Sending a
        different amount won&apos;t route to you.
      </p>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2.5">
        <code className="font-mono text-sm text-ink-900">{stage.command}</code>
        <button
          onClick={() => navigator.clipboard.writeText(stage.command)}
          className="shrink-0 font-mono text-[0.6875rem] text-brass-600 uppercase hover:text-brass-500"
        >
          Copy
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={check}
          disabled={pending}
          className="rounded-sm bg-brass-400 px-4 py-2 font-body text-sm font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-50"
        >
          {stage.checking ? "Checking…" : "Check for my deposit"}
        </button>
        <button
          onClick={cancel}
          disabled={pending}
          className="rounded-sm border border-ink-600/40 px-4 py-2 font-body text-sm text-ink-900/70 transition hover:bg-ink-900/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {stage.message && (
        <p className={`mt-3 text-xs ${stage.message.startsWith("Credited") ? "text-moss-500" : "text-ink-700/60"}`}>
          {stage.message}
        </p>
      )}
    </div>
  );
}
