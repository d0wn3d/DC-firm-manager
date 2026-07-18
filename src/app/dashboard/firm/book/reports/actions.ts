"use server";

import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmAccounts } from "@/lib/treasury";
import { getChartOfAccounts } from "@/lib/accounts";
import { getBooksReport, type BooksReport } from "@/lib/reports";

export async function fetchReport(startIso: string, endIso: string): Promise<BooksReport | null> {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  const accounts = await getFirmAccounts(session.firm.treasury_jwt).catch(() => []);
  if (accounts.length === 0) return null;

  const categories = await getChartOfAccounts(db, session.firm.id);
  return getBooksReport(db, session.firm.treasury_jwt, session.firm.id, accounts, categories, new Date(startIso), new Date(endIso));
}
