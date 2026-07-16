"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { tagJournalEntry } from "@/lib/journal";

/**
 * Tags happen optimistically on the client (see Journal.tsx), so this
 * deliberately does NOT revalidate the journal path itself — that would
 * force a full Treasury re-fetch across every account on every single tag.
 * Reports does need a fresh read next time it's opened, since totals
 * depend on category assignment.
 */
export async function tagEntry(accountId: number, postingId: number, categoryId: string | null) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  await tagJournalEntry(db, session.firm.id, accountId, postingId, categoryId);
  revalidatePath("/dashboard/firm/book/reports");
}
