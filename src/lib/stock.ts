export interface StockSource {
  current_stock: number | null;
  stock_at: string | null;
  manual_stock: number | null;
  manual_stock_at: string | null;
}

export interface EffectiveStock {
  value: number | null;
  source: "treasury" | "manual" | null;
}

export const SEVERITY = { ok: 0, low: 1, empty: 2 } as const;
export type AlertState = keyof typeof SEVERITY;

/** Shared by the poll job and the manual-stock-update action, so a hand
 * edit is reflected in the alert stamp immediately rather than waiting
 * for the next sync cycle to recompute it. */
export function stateFor(stock: number | null, threshold: number | null): AlertState {
  if (stock === null) return "ok";
  if (stock <= 0) return "empty";
  if (threshold !== null && stock <= threshold) return "low";
  return "ok";
}

/**
 * A shop's displayed/alerted-on stock is whichever of the two numbers is
 * more recent: the Treasury API's `current_stock` (as of `stock_at`), or a
 * manual correction (as of `manual_stock_at`). This means a manual edit
 * sticks immediately and survives the next poll — but once DC's own
 * `stock_at` moves past the manual edit's timestamp, Treasury data takes
 * over again automatically, since that means DC has genuinely newer
 * information than whatever prompted the manual correction.
 */
export function effectiveStock(shop: StockSource): EffectiveStock {
  const treasuryAt = shop.stock_at ? new Date(shop.stock_at).getTime() : null;
  const manualAt = shop.manual_stock_at ? new Date(shop.manual_stock_at).getTime() : null;

  if (manualAt !== null && (treasuryAt === null || manualAt > treasuryAt)) {
    return { value: shop.manual_stock, source: "manual" };
  }
  if (treasuryAt !== null) {
    return { value: shop.current_stock, source: "treasury" };
  }
  return { value: shop.manual_stock ?? shop.current_stock ?? null, source: null };
}
