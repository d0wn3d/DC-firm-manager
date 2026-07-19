import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmAccounts, getFirmEmployees } from "@/lib/treasury";
import { getChartOfAccounts } from "@/lib/accounts";
import { getBusinessKPIs } from "@/lib/analytics";
import { Analytics } from "./Analytics";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfLastMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function endOfLastMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const [accounts, categories, employees] = await Promise.all([
    getFirmAccounts(session.firm.treasury_jwt).catch(() => []),
    getChartOfAccounts(db, session.firm.id),
    getFirmEmployees(session.firm.treasury_jwt).catch(() => null),
  ]);

  const now = new Date();
  const kpis =
    accounts.length > 0
      ? await getBusinessKPIs(
          db,
          session.firm.treasury_jwt,
          session.firm.id,
          accounts,
          categories,
          employees?.length ?? null,
          startOfMonth(now),
          now,
          [startOfLastMonth(now), endOfLastMonth(now)],
        )
      : null;

  return <Analytics initialKPIs={kpis} hasAccounts={accounts.length > 0} />;
}
