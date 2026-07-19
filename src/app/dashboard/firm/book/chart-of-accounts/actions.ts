"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import * as chartOfAccounts from "@/lib/accounts";
import { chartOfAccountsCacheTag, type AccountType } from "@/lib/accounts";

async function requireFirm() {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");
  return session.firm;
}

export async function createCategory(input: { code: string; name: string; type: AccountType }) {
  const firm = await requireFirm();
  const db = createServiceClient();
  await chartOfAccounts.createCategory(db, firm.id, input);
  revalidateTag(chartOfAccountsCacheTag(firm.id));
  revalidatePath("/dashboard/firm/book/chart-of-accounts");
}

export async function renameCategory(id: string, input: { code: string; name: string }) {
  const firm = await requireFirm();
  const db = createServiceClient();
  await chartOfAccounts.renameCategory(db, firm.id, id, input);
  revalidateTag(chartOfAccountsCacheTag(firm.id));
  revalidatePath("/dashboard/firm/book/chart-of-accounts");
  revalidatePath("/dashboard/firm/book/journal");
}

export async function archiveCategory(id: string) {
  const firm = await requireFirm();
  const db = createServiceClient();
  await chartOfAccounts.archiveCategory(db, firm.id, id);
  revalidateTag(chartOfAccountsCacheTag(firm.id));
  revalidatePath("/dashboard/firm/book/chart-of-accounts");
  revalidatePath("/dashboard/firm/book/journal");
}
