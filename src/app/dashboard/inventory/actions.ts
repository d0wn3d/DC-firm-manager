"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getSession } from "@/lib/auth";
import { pollFirm } from "@/lib/poll";
import { stateFor } from "@/lib/stock";

export async function updateThreshold(shopId: number, threshold: number | null) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();

  // Recompute the alert stamp against whatever stock is currently in
  // effect, so tightening/loosening a threshold updates the badge
  // immediately rather than waiting for the next sync.
  const { data: shop } = await db
    .from("shops")
    .select("current_stock, stock_at, manual_stock, manual_stock_at")
    .eq("shop_id", shopId)
    .eq("firm_id", session.firm.id)
    .single();

  const effective =
    shop?.manual_stock_at && (!shop.stock_at || new Date(shop.manual_stock_at) > new Date(shop.stock_at))
      ? shop.manual_stock
      : (shop?.current_stock ?? null);

  const { error } = await db
    .from("shops")
    .update({ low_stock_threshold: threshold, last_alert_state: stateFor(effective, threshold) })
    .eq("shop_id", shopId)
    .eq("firm_id", session.firm.id); // belt-and-suspenders: never touch another firm's row

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/inventory");
}

/**
 * Manual stock correction. Writes manual_stock/manual_stock_at (not
 * current_stock, which stays Treasury-owned) and recomputes the alert
 * stamp immediately — see effectiveStock() in lib/stock.ts for why a
 * timestamped override rather than a flat overwrite.
 */
export async function updateStock(shopId: number, stock: number) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  const { data: shop } = await db
    .from("shops")
    .select("low_stock_threshold")
    .eq("shop_id", shopId)
    .eq("firm_id", session.firm.id)
    .single();

  const { error } = await db
    .from("shops")
    .update({
      manual_stock: stock,
      manual_stock_at: new Date().toISOString(),
      last_alert_state: stateFor(stock, shop?.low_stock_threshold ?? null),
    })
    .eq("shop_id", shopId)
    .eq("firm_id", session.firm.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/firm");
}

export async function updateNotes(shopId: number, notes: string) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  const { error } = await db
    .from("shops")
    .update({ notes: notes || null })
    .eq("shop_id", shopId)
    .eq("firm_id", session.firm.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/inventory");
}

export async function syncNow() {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const result = await pollFirm(session.firm);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/firm");
  return result;
}
