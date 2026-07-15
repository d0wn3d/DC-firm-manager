"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualItem } from "./actions";

export function AddItemForm() {
  const [open, setOpen] = useState(false);
  const [itemKey, setItemKey] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [method, setMethod] = useState<"lowest_shop_price" | "manual_price">("manual_price");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const qty = Number(quantity);
    if (!itemKey.trim() || !itemName.trim()) {
      setError("Item key and name are required.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      setError("Enter a whole-number quantity.");
      return;
    }
    if (method === "manual_price" && (price.trim() === "" || Number.isNaN(Number(price)))) {
      setError("Enter a price, or switch to lowest shop price.");
      return;
    }

    setError(null);
    startTransition(async () => {
      await addManualItem({
        itemKey: itemKey.trim(),
        itemName: itemName.trim(),
        quantity: qty,
        valuationMethod: method,
        manualUnitPrice: method === "manual_price" ? Number(price) : null,
      });
      setItemKey("");
      setItemName("");
      setQuantity("");
      setPrice("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-sm border border-brass-400/40 px-4 py-2 font-mono text-xs tracking-wide text-brass-300 uppercase transition hover:bg-brass-400/10"
      >
        + Add inventory
      </button>
    );
  }

  return (
    <div className="ledger-sheet rounded-sm border border-ink-700 p-6">
      <p className="mb-4 font-display text-lg text-ink-900">Add inventory not in any shop</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase">
            Item key
          </label>
          <input
            value={itemKey}
            onChange={(e) => setItemKey(e.target.value)}
            placeholder="Netherrack"
            className="w-full rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 font-mono text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
          />
          <p className="mt-1 text-[0.6875rem] text-ink-700/50">
            Match the item key you use in a shop for &quot;lowest shop price&quot; to work.
          </p>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase">
            Display name
          </label>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Netherrack"
            className="w-full rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase">
            Quantity
          </label>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="500000"
            className="w-full rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 font-mono text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase">
            Value by
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMethod("manual_price")}
              className={`flex-1 rounded-sm border px-2 py-2 font-mono text-xs uppercase transition ${
                method === "manual_price"
                  ? "border-brass-400 bg-brass-400/10 text-brass-600"
                  : "border-ink-600/25 text-ink-700/60"
              }`}
            >
              Manual price
            </button>
            <button
              type="button"
              onClick={() => setMethod("lowest_shop_price")}
              className={`flex-1 rounded-sm border px-2 py-2 font-mono text-xs uppercase transition ${
                method === "lowest_shop_price"
                  ? "border-brass-400 bg-brass-400/10 text-brass-600"
                  : "border-ink-600/25 text-ink-700/60"
              }`}
            >
              Lowest shop price
            </button>
          </div>
        </div>
        {method === "manual_price" && (
          <div className="sm:col-span-2">
            <label className="mb-1 block font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase">
              Price per unit
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.05"
              className="w-32 rounded-sm border border-ink-600/25 bg-paper-100 px-3 py-2 font-mono text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none"
            />
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-rust-500">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-sm bg-brass-400 px-4 py-2 font-body text-sm font-semibold text-ink-950 transition hover:bg-brass-300 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-sm border border-ink-600/40 px-4 py-2 font-body text-sm text-ink-900/70 transition hover:bg-ink-900/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
