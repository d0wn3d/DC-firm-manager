"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createDepositRequest, checkDepositRequest, LedgerError } from "@/lib/ledger";

export interface ActionResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function startDeposit(wholeDollarAmount: number): Promise<
  ActionResult<{ id: string; command: string; expiresAt: string }>
> {
  const session = await getSession();
  if (!session?.firm) return { ok: false, error: "Not connected to a firm." };

  try {
    const db = createServiceClient();
    const request = await createDepositRequest(db, session.firm.id, session.userId, wholeDollarAmount);
    return { ok: true, data: { id: request.id, command: request.command, expiresAt: request.expires_at } };
  } catch (err) {
    return { ok: false, error: err instanceof LedgerError ? err.message : "Couldn't start a deposit." };
  }
}

export async function checkDeposit(requestId: string): Promise<ActionResult<{ matched: boolean; message: string }>> {
  const session = await getSession();
  if (!session?.firm) return { ok: false, error: "Not connected to a firm." };

  try {
    const db = createServiceClient();
    const result = await checkDepositRequest(db, requestId, session.firm.id);
    if (result.matched) revalidatePath("/dashboard/firm/wallet");
    return { ok: true, data: { matched: result.matched, message: result.message } };
  } catch (err) {
    return { ok: false, error: err instanceof LedgerError ? err.message : "Couldn't check that deposit." };
  }
}

export async function cancelDeposit(requestId: string) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  await db
    .from("deposit_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("firm_id", session.firm.id)
    .eq("status", "pending");
}
