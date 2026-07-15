"use client";

import { useState, useTransition } from "react";
import { updateManualItem, deleteManualItem, setPriceOverride, clearPriceOverride } from "./actions";
import type { WarehouseLine } from "@/lib/valuation";

function money(v: number | null) {
  if (v === null) return "—";
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const GRID = "sm:grid sm:grid-cols-[1.3fr_0.8fr_1fr_0.9fr_0.9fr_auto]";

function PriceCell({ line }: { line: WarehouseLine }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(line.unitPrice?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function saveManualItemPrice() {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return;
    startTransition(() => updateManualItem(line.manualItemId!, { manualUnitPrice: parsed }));
    setEditing(false);
  }

  function saveOverride() {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return;
    startTransition(() => setPriceOverride(line.itemKey, parsed));
    setEditing(false);
  }

  function useLowestShopPrice() {
    startTransition(() => {
      if (line.source === "manual") {
        updateManualItem(line.manualItemId!, { valuationMethod: "lowest_shop_price" });
      } else {
        clearPriceOverride(line.itemKey);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          autoFocus
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => (line.source === "manual" ? saveManualItemPrice() : saveOverride())}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-20 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 text-right font-mono text-sm text-ink-900 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {line.pricedBy === "lowest_shop_price" && (
        <span className="font-mono text-[0.6rem] text-moss-500 uppercase">lowest</span>
      )}
      <button
        onClick={() => {
          setValue(line.unitPrice?.toString() ?? "");
          setEditing(true);
        }}
        disabled={pending}
        className="font-mono text-sm text-ink-900 underline decoration-dotted underline-offset-2 disabled:opacity-50"
      >
        {money(line.unitPrice)}
      </button>
      {line.pricedBy === "manual" && (
        <button
          onClick={useLowestShopPrice}
          disabled={pending}
          title="Use the firm's lowest shop price instead"
          className="font-mono text-[0.6rem] text-brass-600 uppercase hover:text-brass-500"
        >
          ↺
        </button>
      )}
    </div>
  );
}

function QuantityCell({ line }: { line: WarehouseLine }) {
  const [value, setValue] = useState(line.quantity.toString());
  const [pending, startTransition] = useTransition();

  if (line.source === "chestshop") {
    return <span className="font-mono text-sm text-ink-700/70">{line.quantity}</span>;
  }

  function save() {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setValue(line.quantity.toString());
      return;
    }
    startTransition(() => updateManualItem(line.manualItemId!, { quantity: parsed }));
  }

  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      disabled={pending}
      className="w-20 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 text-right font-mono text-sm text-ink-900 focus:outline-none disabled:opacity-50"
    />
  );
}

function Row({ line }: { line: WarehouseLine }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className={`flex flex-col gap-2 border-b border-ink-900/10 px-5 py-3 last:border-b-0 sm:items-center sm:gap-4 ${GRID}`}>
      <div>
        <p className="text-sm font-medium text-ink-900">{line.itemName}</p>
        <span className="font-mono text-[0.6rem] text-ink-700/40 uppercase">
          {line.source === "chestshop" ? "from your shops" : "manual"}
        </span>
      </div>
      <div className="text-right sm:text-right">
        <QuantityCell line={line} />
      </div>
      <div />
      <div className="text-right">
        <PriceCell line={line} />
      </div>
      <p className="text-right font-display text-lg text-ink-900">{money(line.totalValue)}</p>
      <div className="text-right">
        {line.source === "manual" && (
          <button
            onClick={() => startTransition(() => deleteManualItem(line.manualItemId!))}
            disabled={pending}
            className="font-mono text-xs text-rust-500 uppercase hover:text-rust-400 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

export function WarehouseTable({ lines }: { lines: WarehouseLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">Nothing in the warehouse yet</p>
        <p className="mt-2 text-sm text-ink-700/70">
          Stock your firm sells shows up here automatically. Add anything sitting in storage below.
        </p>
      </div>
    );
  }

  return (
    <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
      <div
        className={`hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase ${GRID}`}
      >
        <span>Item</span>
        <span className="text-right">Quantity</span>
        <span />
        <span className="text-right">Unit value</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      <ul>
        {lines.map((line) => (
          <Row key={`${line.source}-${line.manualItemId ?? line.itemKey}`} line={line} />
        ))}
      </ul>
    </div>
  );
}
