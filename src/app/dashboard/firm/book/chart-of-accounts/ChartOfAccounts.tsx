"use client";

import { useState, useTransition } from "react";
import { createCategory, renameCategory, archiveCategory } from "./actions";
import { ACCOUNT_TYPE_ORDER, ACCOUNT_TYPE_LABELS, type ChartAccount, type AccountType } from "@/lib/accounts";

const TYPE_TONE: Record<AccountType, string> = {
  income: "text-moss-500",
  expense: "text-rust-500",
  asset: "text-brass-600",
  liability: "text-ink-900",
  equity: "text-ink-900",
};

function Row({ category }: { category: ChartAccount }) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(category.code);
  const [name, setName] = useState(category.name);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!code.trim() || !name.trim()) {
      setCode(category.code);
      setName(category.name);
      setEditing(false);
      return;
    }
    startTransition(() => renameCategory(category.id, { code: code.trim(), name: name.trim() }));
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 border-b border-ink-900/10 px-5 py-2.5 last:border-b-0">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-16 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 font-mono text-xs text-ink-900 focus:outline-none"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="flex-1 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 text-sm text-ink-900 focus:outline-none"
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-ink-900/10 px-5 py-2.5 last:border-b-0">
      <button onClick={() => setEditing(true)} className="flex flex-1 items-center gap-3 text-left">
        <span className="font-mono text-xs text-ink-700/50">{category.code}</span>
        <span className="text-sm text-ink-900">{category.name}</span>
        {category.is_system && <span className="font-mono text-[0.6rem] text-ink-700/40 uppercase">default</span>}
      </button>
      <button
        onClick={() => startTransition(() => archiveCategory(category.id))}
        disabled={pending}
        className="font-mono text-[0.6875rem] text-ink-700/40 uppercase hover:text-rust-500 disabled:opacity-50"
      >
        Archive
      </button>
    </li>
  );
}

function AddForm({ type }: { type: AccountType }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createCategory({ code: code.trim(), name: name.trim(), type });
        setCode("");
        setName("");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that category.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-t border-ink-900/10 px-5 py-2.5 text-left font-mono text-[0.6875rem] text-ink-700/50 uppercase hover:text-ink-900"
      >
        + Add {ACCOUNT_TYPE_LABELS[type].toLowerCase()} category
      </button>
    );
  }

  return (
    <div className="border-t border-ink-900/10 px-5 py-2.5">
      <div className="flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          className="w-16 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 font-mono text-xs text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-sm bg-brass-400 px-3 py-1 font-mono text-xs text-ink-950 uppercase hover:bg-brass-300 disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="font-mono text-xs text-ink-700/50 uppercase"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rust-500">{error}</p>}
    </div>
  );
}

export function ChartOfAccounts({ categories }: { categories: ChartAccount[] }) {
  const byType = new Map<AccountType, ChartAccount[]>();
  for (const c of categories) {
    const list = byType.get(c.type) ?? [];
    list.push(c);
    byType.set(c.type, list);
  }

  return (
    <div className="space-y-5">
      {ACCOUNT_TYPE_ORDER.map((type) => {
        const list = byType.get(type) ?? [];
        return (
          <section key={type} className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
            <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-3">
              <span className={`font-display text-lg ${TYPE_TONE[type]}`}>{ACCOUNT_TYPE_LABELS[type]}</span>
              <span className="font-mono text-[0.6875rem] text-ink-700/50">{list.length}</span>
            </div>
            {list.length > 0 && <ul>{list.map((c) => <Row key={c.id} category={c} />)}</ul>}
            <AddForm type={type} />
          </section>
        );
      })}
    </div>
  );
}
