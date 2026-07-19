"use server";

import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmAccounts, getFirmEmployees } from "@/lib/treasury";
import { getChartOfAccounts } from "@/lib/accounts";
import { getBusinessKPIs, type BusinessKPIs } from "@/lib/analytics";

export async function fetchKPIs(
  startIso: string,
  endIso: string,
  previousStartIso: string | null,
  previousEndIso: string | null,
): Promise<BusinessKPIs | null> {
  const session = await getSession();
  if (!session?.firm) throw new Error("Not connected to a firm.");

  const db = createServiceClient();
  const [accounts, employees] = await Promise.all([
    getFirmAccounts(session.firm.treasury_jwt).catch(() => []),
    getFirmEmployees(session.firm.treasury_jwt).catch(() => null),
  ]);
  if (accounts.length === 0) return null;

  const categories = await getChartOfAccounts(db, session.firm.id);
  const previousRange: [Date, Date] | null =
    previousStartIso && previousEndIso ? [new Date(previousStartIso), new Date(previousEndIso)] : null;

  return getBusinessKPIs(
    db,
    session.firm.treasury_jwt,
    session.firm.id,
    accounts,
    categories,
    employees?.length ?? null,
    new Date(startIso),
    new Date(endIso),
    previousRange,
  );
}
