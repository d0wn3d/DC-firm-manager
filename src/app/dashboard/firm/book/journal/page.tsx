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
  const [accounts, categories] = await Promise.all([
    getFirmAccounts(session.firm.treasury_jwt).catch(() => []),
    getChartOfAccounts(db, session.firm.id),
  ]);

  const feed =
    accounts.length > 0 ? await getJournalFeed(db, session.firm.treasury_jwt, session.firm.id, accounts, categories) : [];

  return <Journal initialFeed={feed} categories={categories} accounts={accounts} />;
}
