import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getChartOfAccounts } from "@/lib/accounts";
import { ChartOfAccounts } from "./ChartOfAccounts";

export default async function ChartOfAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const categories = await getChartOfAccounts(db, session.firm.id);

  return <ChartOfAccounts categories={categories} />;
}
