"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

async function requireFirm() {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");
  return session.firm;
}

export async function addManualItem(input: {
  itemKey: string;
  itemName: string;
  quantity: number;
  valuationMethod: "lowest_shop_price" | "manual_price";
  manualUnitPrice: number | null;
}) {
  const firm = await requireFirm();
  if (!input.itemKey.trim() || !input.itemName.trim()) {
    throw new Error("Item key and name are required.");
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error("Quantity must be zero or more.");
  }

  const db = createServiceClient();
  const { error } = await db.from("warehouse_manual_items").insert({
    firm_id: firm.id,
    item_key: input.itemKey.trim(),
    item_name: input.itemName.trim(),
    quantity: input.quantity,
    valuation_method: input.valuationMethod,
    manual_unit_price: input.valuationMethod === "manual_price" ? input.manualUnitPrice : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/firm/warehouse");
  revalidatePath("/dashboard/firm/overview");
}

export async function updateManualItem(
  id: string,
  patch: Partial<{
    quantity: number;
    valuationMethod: "lowest_shop_price" | "manual_price";
    manualUnitPrice: number | null;
  }>,
) {
  const firm = await requireFirm();
  const db = createServiceClient();

  const { error } = await db
    .from("warehouse_manual_items")
    .update({
      updated_at: new Date().toISOString(),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.valuationMethod !== undefined ? { valuation_method: patch.valuationMethod } : {}),
      ...(patch.manualUnitPrice !== undefined ? { manual_unit_price: patch.manualUnitPrice } : {}),
    })
    .eq("id", id)
    .eq("firm_id", firm.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/firm/warehouse");
  revalidatePath("/dashboard/firm/overview");
}

export async function deleteManualItem(id: string) {
  const firm = await requireFirm();
  const db = createServiceClient();
  await db.from("warehouse_manual_items").delete().eq("id", id).eq("firm_id", firm.id);
  revalidatePath("/dashboard/firm/warehouse");
  revalidatePath("/dashboard/firm/overview");
}

/** For a ChestShop-tracked item: pin its valuation to a manual number instead of the auto lowest-shop-price. */
export async function setPriceOverride(itemKey: string, price: number) {
  const firm = await requireFirm();
  if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid price.");

  const db = createServiceClient();
  const { error } = await db
    .from("warehouse_price_overrides")
    .upsert(
      { firm_id: firm.id, item_key: itemKey, manual_unit_price: price, updated_at: new Date().toISOString() },
      { onConflict: "firm_id,item_key" },
    );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/firm/warehouse");
  revalidatePath("/dashboard/firm/overview");
}

/** Reverts a ChestShop-tracked item back to auto lowest-shop-price valuation. */
export async function clearPriceOverride(itemKey: string) {
  const firm = await requireFirm();
  const db = createServiceClient();
  await db.from("warehouse_price_overrides").delete().eq("firm_id", firm.id).eq("item_key", itemKey);
  revalidatePath("/dashboard/firm/warehouse");
  revalidatePath("/dashboard/firm/overview");
}
