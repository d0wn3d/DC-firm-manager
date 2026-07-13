"use server";

import { getSession } from "@/lib/auth";
import { getAccountTransactions } from "@/lib/treasury";

export async function fetchTransactions(accountId: number, page: number) {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");
  return getAccountTransactions(session.firm.treasury_jwt, accountId, page, 25);
}
