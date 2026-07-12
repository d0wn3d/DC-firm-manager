import "server-only";
import { getItemDetail } from "./treasury";
import { effectiveStock } from "./stock";
import type { Database } from "./supabase/types";

type ShopRow = Database["public"]["Tables"]["shops"]["Row"];
type ValuationInsert = Database["public"]["Tables"]["item_valuations"]["Insert"];

/**
 * Values one item using the same two-step rule every time: DC's own 24h
 * market average first, and only when that's genuinely unavailable (no
 * trades in the window — not just a low number) do we fall back to the
 * cheapest price the firm itself is asking across its own shops for that
 * item. Note the field: `buyPrice` is what a *player* pays to buy from the
 * shop — i.e. the firm's own asking/selling price — which is what "we sell
 * coal for 0.3" actually maps to, not `sellPrice` (what the firm pays to
 * acquire more).
 */
async function valueOneItem(
  jwt: string,
  itemKey: string,
  ownShops: ShopRow[],
): Promise<{ unitValue: number | null; source: ValuationInsert["value_source"] }> {
  try {
    const detail = await getItemDetail(jwt, itemKey, 1);
    if (detail.tradeCount > 0 && detail.avgUnitPrice !== null) {
      const parsed = Number(detail.avgUnitPrice);
      if (!Number.isNaN(parsed)) {
        return { unitValue: parsed, source: "market_24h" };
      }
    }
  } catch {
    // Falls through to the own-shops fallback below.
  }

  const askingPrices = ownShops
    .map((s) => (s.buy_price !== null ? Number(s.buy_price) : null))
    .filter((n): n is number => n !== null && !Number.isNaN(n));

  if (askingPrices.length > 0) {
    return { unitValue: Math.min(...askingPrices), source: "own_shops_fallback" };
  }

  return { unitValue: null, source: "unavailable" };
}

export interface ValuationSummary {
  totalValue: number;
  lines: ValuationInsert[];
}

/**
 * Groups the firm's already-synced shops by item, values each one, and
 * returns rows ready to upsert into item_valuations. Only fetches market
 * pricing for items the firm actually holds stock of — no point spending
 * an API call valuing something worth $0.
 */
export async function computeValuation(
  jwt: string,
  firmId: string,
  shops: ShopRow[],
): Promise<ValuationSummary> {
  const byItem = new Map<string, ShopRow[]>();
  for (const shop of shops) {
    const list = byItem.get(shop.item_key) ?? [];
    list.push(shop);
    byItem.set(shop.item_key, list);
  }

  const lines: ValuationInsert[] = [];
  let totalValue = 0;

  for (const [itemKey, group] of byItem) {
    const totalQuantity = group.reduce((sum, s) => sum + (effectiveStock(s).value ?? 0), 0);
    const itemName = group.find((s) => s.item_name)?.item_name ?? null;

    if (totalQuantity <= 0) {
      lines.push({
        firm_id: firmId,
        item_key: itemKey,
        item_name: itemName,
        unit_value: null,
        value_source: "unavailable",
        total_quantity: 0,
        total_value: 0,
        computed_at: new Date().toISOString(),
      });
      continue;
    }

    const { unitValue, source } = await valueOneItem(jwt, itemKey, group);
    const lineValue = unitValue !== null ? Math.round(unitValue * totalQuantity * 100) / 100 : 0;
    totalValue += lineValue;

    lines.push({
      firm_id: firmId,
      item_key: itemKey,
      item_name: itemName,
      unit_value: unitValue,
      value_source: source,
      total_quantity: totalQuantity,
      total_value: lineValue,
      computed_at: new Date().toISOString(),
    });
  }

  return { totalValue: Math.round(totalValue * 100) / 100, lines };
}
