import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmAccounts } from "@/lib/treasury";
import { getChartOfAccounts } from "@/lib/accounts";
import { getJournalFeed } from "@/lib/journal";
import { Journal } from "./Journal";

export default async function JournalPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const db = createServiceClient();
  const accounts = await getFirmAccounts(session.firm.treasury_jwt).catch(() => []);

  const [categories, feed] = await Promise.all([
    getChartOfAccounts(db, session.firm.id),
    accounts.length > 0 ? getJournalFeed(db, session.firm.treasury_jwt, session.firm.id, accounts) : Promise.resolve([]),
  ]);

  return <Journal initialFeed={feed} categories={categories} accounts={accounts} />;
}
