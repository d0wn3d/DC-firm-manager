import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFirmAccounts, getAccountTransactions } from "@/lib/treasury";
import { Ledger } from "./Ledger";

export default async function BookPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  const accounts = await getFirmAccounts(session.firm.treasury_jwt).catch(() => []);
  const defaultAccountId = accounts[0]?.accountId ?? null;
  const initialLedgerPage = defaultAccountId
    ? await getAccountTransactions(session.firm.treasury_jwt, defaultAccountId, 1, 25).catch(() => null)
    : null;

  return (
    <Ledger accounts={accounts} initialAccountId={defaultAccountId} initialPage={initialLedgerPage} />
  );
}
