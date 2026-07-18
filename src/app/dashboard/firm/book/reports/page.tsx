import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmAccounts } from "@/lib/treasury";
import { getChartOfAccounts } from "@/lib/accounts";
import { getBooksReport } from "@/lib/reports";
import { getWarehouseValuation } from "@/lib/valuation";
import { Reports } from "./Reports";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const accounts = await getFirmAccounts(session.firm.treasury_jwt).catch(() => []);

  const [categories, warehouse] = await Promise.all([
    getChartOfAccounts(db, session.firm.id),
    getWarehouseValuation(db, session.firm.id),
  ]);

  const now = new Date();
  const report =
    accounts.length > 0
      ? await getBooksReport(db, session.firm.treasury_jwt, session.firm.id, accounts, categories, startOfMonth(now), now)
      : null;

  const cashTotal = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return (
    <Reports
      initialReport={report}
      hasAccounts={accounts.length > 0}
      snapshot={{ cash: cashTotal, inventory: warehouse.totalValue }}
    />
  );
}
