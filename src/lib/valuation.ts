import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveStock } from "./stock";
import type { Database } from "./supabase/types";

type DB = SupabaseClient<Database>;

export type PricedBy = "lowest_shop_price" | "manual" | "unavailable";

export interface WarehouseLine {
  itemKey: string;
  itemName: string;
  quantity: number;
  unitPrice: number | null;
  pricedBy: PricedBy;
  totalValue: number;
  source: "chestshop" | "manual";
  manualItemId?: string;
  valuationMethod?: "lowest_shop_price" | "manual_price";
}

export interface WarehouseValuation {
  lines: WarehouseLine[];
  totalValue: number;
  unpricedCount: number;
}

/**
 * The firm's own cheapest listed price per item, straight from the shops
 * table — no external API call. This used to be a 24h-market-average
 * lookup against DC's API, but that produced bad numbers (a thin/skewed
 * server-wide average overvaluing bulk items like Netherrack — $4.32 for
 * something the firm actually sells at $0.05). This is the only automatic
 * pricing signal now; everything else is a manual number.
 */
async function getLowestShopPrices(db: DB, firmId: string): Promise<Map<string, number>> {
  const { data: shops } = await db
    .from("shops")
    .select("item_key, buy_price")
    .eq("firm_id", firmId)
    .not("buy_price", "is", null);

  const lowest = new Map<string, number>();
  for (const shop of shops ?? []) {
    const price = Number(shop.buy_price);
    if (Number.isNaN(price)) continue;
    const current = lowest.get(shop.item_key);
    if (current === undefined || price < current) {
      lowest.set(shop.item_key, price);
    }
  }
  return lowest;
}

/**
 * Combines auto-synced ChestShop inventory with manually-added warehouse
 * stock into one priced list. Each line is priced by either the firm's own
 * lowest listed price for that item, or a manual number — nothing here
 * calls the Treasury API, so it's cheap enough to compute on every page
 * load rather than needing to be cached by the poll job.
 */
export async function getWarehouseValuation(db: DB, firmId: string): Promise<WarehouseValuation> {
  const [{ data: shops }, { data: overrides }, { data: manualItems }, lowestShopPrices] = await Promise.all([
    db.from("shops").select("*").eq("firm_id", firmId),
    db.from("warehouse_price_overrides").select("*").eq("firm_id", firmId),
    db.from("warehouse_manual_items").select("*").eq("firm_id", firmId),
    getLowestShopPrices(db, firmId),
  ]);

  const overrideByKey = new Map((overrides ?? []).map((o) => [o.item_key, o.manual_unit_price]));

  const byItem = new Map<string, { name: string; quantity: number }>();
  for (const shop of shops ?? []) {
    const existing = byItem.get(shop.item_key);
    const qty = effectiveStock(shop).value ?? 0;
    byItem.set(shop.item_key, {
      name: existing?.name || shop.item_name || shop.item_key,
      quantity: (existing?.quantity ?? 0) + qty,
    });
  }

  const lines: WarehouseLine[] = [];

  for (const [itemKey, { name, quantity }] of byItem) {
    if (quantity <= 0) continue;
    const override = overrideByKey.get(itemKey);
    const lowest = lowestShopPrices.get(itemKey) ?? null;
    const unitPrice = override ?? lowest;
    const pricedBy: PricedBy =
      override !== undefined ? "manual" : lowest !== null ? "lowest_shop_price" : "unavailable";

    lines.push({
      itemKey,
      itemName: name,
      quantity,
      unitPrice,
      pricedBy,
      totalValue: unitPrice !== null ? Math.round(unitPrice * quantity * 100) / 100 : 0,
      source: "chestshop",
    });
  }

  for (const item of manualItems ?? []) {
    let unitPrice: number | null;
    let pricedBy: PricedBy;

    if (item.valuation_method === "manual_price") {
      unitPrice = item.manual_unit_price;
      pricedBy = unitPrice !== null ? "manual" : "unavailable";
    } else {
      unitPrice = lowestShopPrices.get(item.item_key) ?? null;
      pricedBy = unitPrice !== null ? "lowest_shop_price" : "unavailable";
    }

    lines.push({
      itemKey: item.item_key,
      itemName: item.item_name,
      quantity: item.quantity,
      unitPrice,
      pricedBy,
      totalValue: unitPrice !== null ? Math.round(unitPrice * item.quantity * 100) / 100 : 0,
      source: "manual",
      manualItemId: item.id,
      valuationMethod: item.valuation_method,
    });
  }

  lines.sort((a, b) => b.totalValue - a.totalValue);

  return {
    lines,
    totalValue: Math.round(lines.reduce((sum, l) => sum + l.totalValue, 0) * 100) / 100,
    unpricedCount: lines.filter((l) => l.pricedBy === "unavailable" && l.quantity > 0).length,
  };
}
