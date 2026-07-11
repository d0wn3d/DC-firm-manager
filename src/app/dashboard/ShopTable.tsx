"use client";

import { useState, useTransition } from "react";
import { updateThreshold } from "./actions";
import type { Database } from "@/lib/supabase/types";

type Shop = Database["public"]["Tables"]["shops"]["Row"];

const GRID = "sm:grid sm:grid-cols-[1.5fr_1.2fr_0.7fr_0.9fr_0.9fr_0.9fr]";

function money(v: number | null) {
  if (v === null) return null;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function StatusStamp({ state }: { state: Shop["last_alert_state"] }) {
  if (state === "empty") return <span className="stamp text-rust-500">Empty</span>;
  if (state === "low") return <span className="stamp text-brass-500">Low stock</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-wide text-moss-500 uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-moss-400" aria-hidden />
      In stock
    </span>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between sm:block sm:text-right">
      <span className="font-mono text-[0.6875rem] text-ink-700/50 sm:hidden">{label}</span>
      {children}
    </div>
  );
}

export function ShopTable({ shops }: { shops: Shop[] }) {
  return (
    <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
      <div
        className={`hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase ${GRID}`}
      >
        <span>Item</span>
        <span>Location</span>
        <span className="text-right">Stock</span>
        <span className="text-right">Alert below</span>
        <span className="text-right">Buy / Sell</span>
        <span className="text-right">Status</span>
      </div>

      <ul>
        {shops.map((shop) => (
          <li
            key={shop.shop_id}
            className={`flex flex-col gap-2 border-b border-ink-900/10 px-5 py-3.5 last:border-b-0 sm:items-center sm:gap-4 ${GRID}`}
          >
            <div className="flex items-center justify-between gap-2 sm:block">
              <div>
                <p className="text-sm font-medium text-ink-900">
                  {shop.item_name ?? shop.item_key}
                </p>
                {shop.owner_name && (
                  <p className="font-mono text-[0.6875rem] text-ink-700/50">{shop.owner_name}</p>
                )}
              </div>
              <div className="sm:hidden">
                <StatusStamp state={shop.last_alert_state} />
              </div>
            </div>

            <p className="font-mono text-xs text-ink-700/70">
              {shop.world} ({shop.x}, {shop.y}, {shop.z})
            </p>

            <Field label="Stock">
              <span className="font-display text-2xl text-ink-900">
                {shop.current_stock ?? "—"}
              </span>
            </Field>

            <div className="flex items-center justify-between sm:justify-end">
              <span className="font-mono text-[0.6875rem] text-ink-700/50 sm:hidden">
                Alert below
              </span>
              <ThresholdInput shop={shop} />
            </div>

            <Field label="Buy / sell">
              <span className="font-mono text-xs text-ink-700/70">
                {money(shop.buy_price) ?? "—"} / {money(shop.sell_price) ?? "—"}
              </span>
            </Field>

            <div className="hidden sm:flex sm:justify-end">
              <StatusStamp state={shop.last_alert_state} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
