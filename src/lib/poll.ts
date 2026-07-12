import "server-only";
import { createServiceClient } from "./supabase/service";
import { getFirmShops, rotateToken, TreasuryAuthError, type TreasuryShop } from "./treasury";
import { sendStockAlert } from "./discord";
import type { Database } from "./supabase/types";

type FirmRow = Database["public"]["Tables"]["firms"]["Row"];

const SEVERITY = { ok: 0, low: 1, empty: 2 } as const;
type AlertState = keyof typeof SEVERITY;

const ROTATE_IF_EXPIRING_WITHIN_MS = 24 * 60 * 60 * 1000; // rotate a day out, not at the wire

function stateFor(currentStock: number | null, threshold: number | null): AlertState {
  if (currentStock === null) return "ok";
  if (currentStock <= 0) return "empty";
  if (threshold !== null && currentStock <= threshold) return "low";
  return "ok";
}

/**
 * Rotates the firm's Treasury JWT if it's within a day of expiring (or its
 * expiry is unknown), persisting the new token before it's used. Returns
 * the token to actually make requests with. `/auth/rotate` is limited to
 * 5/min so this must never run on every poll unconditionally — only when
 * actually close to expiry.
 */
async function ensureFreshToken(db: ReturnType<typeof createServiceClient>, firm: FirmRow): Promise<string> {
  const expiresAt = firm.treasury_jwt_expires_at ? new Date(firm.treasury_jwt_expires_at) : null;
  const needsRotation = !expiresAt || expiresAt.getTime() - Date.now() < ROTATE_IF_EXPIRING_WITHIN_MS;

  if (!needsRotation) return firm.treasury_jwt;

  try {
    const rotated = await rotateToken(firm.treasury_jwt);
    await db
      .from("firms")
      .update({ treasury_jwt: rotated.token, treasury_jwt_expires_at: rotated.expiresAt })
      .eq("id", firm.id);
    return rotated.token;
  } catch {
    // Rotation failing doesn't mean the current token is dead yet — fall
    // back to it and let the normal 401 handling below catch a real expiry.
    return firm.treasury_jwt;
  }
}

export interface PollResult {
  firmId: string;
  success: boolean;
  shopsSynced: number;
  error?: string;
}

/** Polls one firm's shops from the Treasury API and syncs everything into Supabase. */
export async function pollFirm(firm: FirmRow): Promise<PollResult> {
  const db = createServiceClient();
  const jwt = await ensureFreshToken(db, firm);

  let shops: TreasuryShop[];
  try {
    shops = await getFirmShops(jwt, firm.dc_firm_id);
  } catch (err) {
    const isAuthError = err instanceof TreasuryAuthError;
    if (isAuthError) {
      await db.from("firms").update({ jwt_invalid: true }).eq("id", firm.id);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.from("poll_log").insert({
      firm_id: firm.id,
      success: false,
      shops_synced: 0,
      error: message,
    });
    return { firmId: firm.id, success: false, shopsSynced: 0, error: message };
  }

  // Existing thresholds + alert state, so we don't clobber user-set values
  // and can tell whether a shop just crossed into worse territory.
  const { data: existingRows } = await db
    .from("shops")
    .select("shop_id, low_stock_threshold, last_alert_state")
    .eq("firm_id", firm.id);

  const existingById = new Map((existingRows ?? []).map((r) => [r.shop_id, r]));

  const rowsToUpsert = shops.map((shop) => {
    const existing = existingById.get(shop.shopId);
    const threshold = existing?.low_stock_threshold ?? null;
    const newState = stateFor(shop.currentStock, threshold);

    return {
      shop_id: shop.shopId,
      firm_id: firm.id,
      world: shop.world,
      x: shop.x,
      y: shop.y,
      z: shop.z,
      admin_shop: shop.adminShop,
      account_type: shop.accountType,
      owner_uuid: shop.ownerUuid,
      owner_name: shop.ownerName,
      material: shop.material,
      item_key: shop.itemKey,
      item_name: shop.itemName,
      item_custom: shop.itemCustom,
      buy_price: shop.buyPrice,
      sell_price: shop.sellPrice,
      batch_qty: shop.batchQty,
      current_stock: shop.currentStock,
      stock_at: shop.stockAt,
      last_seen: shop.lastSeen,
      low_stock_threshold: threshold,
      last_alert_state: newState,
      updated_at: new Date().toISOString(),
    };
  });

  if (rowsToUpsert.length > 0) {
    const { error } = await db.from("shops").upsert(rowsToUpsert, { onConflict: "shop_id" });
    if (error) {
      await db.from("poll_log").insert({
        firm_id: firm.id,
        success: false,
        shops_synced: 0,
        error: error.message,
      });
      return { firmId: firm.id, success: false, shopsSynced: 0, error: error.message };
    }
  }

  // Alert only on a worsening transition (ok -> low, ok -> empty, low ->
  // empty), and only for the specific shop that crossed the line — this is
  // what keeps a persistently-empty shop from re-alerting every poll cycle.
  if (firm.discord_webhook_url) {
    for (const shop of shops) {
      const existing = existingById.get(shop.shopId);
      const oldState = (existing?.last_alert_state as AlertState) ?? "ok";
      const newState = stateFor(shop.currentStock, existing?.low_stock_threshold ?? null);

      if (newState !== "ok" && SEVERITY[newState] > SEVERITY[oldState]) {
        try {
          await sendStockAlert(firm.discord_webhook_url, firm.dc_firm_name, shop, newState);
        } catch {
          // Don't let a bad webhook URL fail the whole poll — it'll surface
          // in the dashboard because current_stock still updates correctly.
        }
      }
    }
  }

  if (firm.jwt_invalid) {
    await db.from("firms").update({ jwt_invalid: false }).eq("id", firm.id);
  }

  await db.from("poll_log").insert({
    firm_id: firm.id,
    success: true,
    shops_synced: rowsToUpsert.length,
  });

  return { firmId: firm.id, success: true, shopsSynced: rowsToUpsert.length };
}

/** Polls every connected firm. Used by the Vercel Cron endpoint. */
export async function pollAllFirms(): Promise<PollResult[]> {
  const db = createServiceClient();
  const { data: firms, error } = await db.from("firms").select("*");
  if (error || !firms) return [];

  const results: PollResult[] = [];
  for (const firm of firms) {
    results.push(await pollFirm(firm));
  }
  return results;
}
