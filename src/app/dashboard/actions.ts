"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSession } from "@/lib/auth";
import { pollFirm } from "@/lib/poll";

export async function updateThreshold(shopId: number, threshold: number | null) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  const { error } = await db
    .from("shops")
    .update({ low_stock_threshold: threshold })
    .eq("shop_id", shopId)
    .eq("firm_id", session.firm.id); // belt-and-suspenders: never touch another firm's row

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

export async function syncNow() {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const result = await pollFirm(session.firm);
  revalidatePath("/dashboard");
  return result;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
