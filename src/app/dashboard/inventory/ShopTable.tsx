"use client";

import { useState, useTransition } from "react";
import { updateThreshold, updateStock } from "./actions";
import { effectiveStock, SEVERITY, type AlertState } from "@/lib/stock";
import type { Database } from "@/lib/supabase/types";

type Shop = Database["public"]["Tables"]["shops"]["Row"];

const GRID = "sm:grid sm:grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr]";

function money(v: string | null) {
  if (v === null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function StatusStamp({ state }: { state: AlertState }) {
  if (state === "empty") return <span className="stamp text-rust-500">Empty</span>;
  if (state === "low") return <span className="stamp text-brass-500">Low stock</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-wide text-moss-500 uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-moss-400" aria-hidden />
      In stock
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between sm:block sm:text-right">
      <span className="font-mono text-[0.6875rem] text-ink-700/50 sm:hidden">{label}</span>
      {children}
    </div>
  );
}

function StockInput({ shop, effective }: { shop: Shop; effective: ReturnType<typeof effectiveStock> }) {
  const [value, setValue] = useState(effective.value?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed) || parsed < 0) {
      setValue(effective.value?.toString() ?? "");
      return;
    }
    startTransition(() => updateStock(shop.shop_id, parsed));
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={pending}
        aria-label={`Stock for ${shop.item_name ?? shop.item_key} at ${shop.world} (${shop.x}, ${shop.y}, ${shop.z})`}
        className="w-20 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 text-right font-display text-lg text-ink-900 focus:outline-none disabled:opacity-50"
      />
      {effective.source === "manual" && (
        <span title="Manually set — will switch back to Treasury data once DC's own sync catches up" className="text-[0.6rem] text-brass-600">
          ✎
        </span>
      )}
    </div>
  );
}

function ThresholdInput({ shop }: { shop: Shop }) {
  const [value, setValue] = useState(shop.low_stock_threshold?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setValue(shop.low_stock_threshold?.toString() ?? "");
      return;
    }
    startTransition(() => updateThreshold(shop.shop_id, parsed));
  }

  return (
    <input
      type="number"
      min={0}
      value={value}
      placeholder="off"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      disabled={pending}
      aria-label={`Low-stock threshold for ${shop.item_name ?? shop.item_key}`}
      className="w-16 rounded-sm border border-ink-600/25 bg-paper-100 px-2 py-1 text-right font-mono text-sm text-ink-900 placeholder:text-ink-700/30 focus:outline-none disabled:opacity-50"
    />
  );
}

function ShopRow({ shop }: { shop: Shop }) {
  const effective = effectiveStock(shop);
  const state = shop.last_alert_state;

  return (
    <li className={`flex flex-col gap-2 border-b border-ink-900/10 py-3 pl-4 last:border-b-0 sm:items-center sm:gap-4 ${GRID}`}>
      <p className="font-mono text-xs text-ink-700/70">
        {shop.world} ({shop.x}, {shop.y}, {shop.z})
        {shop.owner_name && <span className="text-ink-700/40"> · {shop.owner_name}</span>}
      </p>

      <Field label="Stock">
        <StockInput shop={shop} effective={effective} />
      </Field>

      <div className="flex items-center justify-between sm:justify-end">
        <span className="font-mono text-[0.6875rem] text-ink-700/50 sm:hidden">Alert below</span>
        <ThresholdInput shop={shop} />
      </div>

      <Field label="Buy / sell">
        <span className="font-mono text-xs text-ink-700/70">
          {money(shop.buy_price) ?? "—"} / {money(shop.sell_price) ?? "—"}
        </span>
      </Field>

      <div className="flex items-center justify-between sm:justify-end">
        <span className="font-mono text-[0.6875rem] text-ink-700/50 sm:hidden">Status</span>
        <StatusStamp state={state} />
      </div>
    </li>
  );
}

function worstState(shops: Shop[]): AlertState {
  return shops.reduce<AlertState>((worst, s) => {
    const state = s.last_alert_state as AlertState;
    return SEVERITY[state] > SEVERITY[worst] ? state : worst;
  }, "ok");
}

export function ShopTable({ shops }: { shops: Shop[] }) {
  const categories = new Map<string, Shop[]>();
  for (const shop of shops) {
    const list = categories.get(shop.item_key) ?? [];
    list.push(shop);
    categories.set(shop.item_key, list);
  }

  const sortedCategories = [...categories.entries()].sort(([, a], [, b]) => {
    const sevDiff = SEVERITY[worstState(b)] - SEVERITY[worstState(a)];
    if (sevDiff !== 0) return sevDiff;
    const nameA = a[0].item_name ?? a[0].item_key;
    const nameB = b[0].item_name ?? b[0].item_key;
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-3">
      {sortedCategories.map(([itemKey, group]) => {
        const label = group[0].item_name ?? itemKey;
        const totalStock = group.reduce((sum, s) => sum + (effectiveStock(s).value ?? 0), 0);
        const worst = worstState(group);

        return (
          <details key={itemKey} open className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 select-none">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-lg text-ink-900">{label}</span>
                <span className="font-mono text-[0.6875rem] text-ink-700/50">
                  {group.length} {group.length === 1 ? "shop" : "shops"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-ink-700/70">{totalStock} total</span>
                <StatusStamp state={worst} />
              </div>
            </summary>

            <div className={`hidden gap-4 border-t border-ink-900/10 py-1.5 pl-4 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/50 uppercase ${GRID}`}>
              <span>Location</span>
              <span className="text-right">Stock</span>
              <span className="text-right">Alert below</span>
              <span className="text-right">Buy / Sell</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="border-t border-ink-900/10 px-5 sm:px-1">
              {group.map((shop) => (
                <ShopRow key={shop.shop_id} shop={shop} />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
