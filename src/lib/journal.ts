import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountTransactions, type TreasuryAccount } from "./treasury";
import type { Database } from "./supabase/types";

type DB = SupabaseClient<Database>;

export interface JournalRow {
  postingId: number;
  accountId: number;
  accountName: string;
  amount: string;
  memo: string | null;
  settledAt: string;
  categoryId: string | null;
}

// How far back the unified feed reaches without the person needing to dig
// further — 3 pages of 100 per account keeps this to a handful of Treasury
// calls even for a firm with several accounts, while covering months of
// typical activity. Reports pull from this same live-fetched window; a firm
// that wants true full-history reporting will eventually want a local
// Treasury mirror table instead of this approach.
const PAGES_PER_ACCOUNT = 3;
const PAGE_SIZE = 100;

/**
 * Merges every Treasury account's transaction history into one
 * chronological feed and left-joins Stockbook's own category tags onto it
 * by (account_id, posting_id). Treasury stays the system of record for the
 * transaction itself — journal_entries only ever stores the label.
 */
export async function getJournalFeed(
  db: DB,
  jwt: string,
  firmId: string,
  accounts: TreasuryAccount[],
): Promise<JournalRow[]> {
  const perAccount = await Promise.all(
    accounts.map(async (account) => {
      const rows: JournalRow[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await getAccountTransactions(jwt, account.accountId, page, PAGE_SIZE);
        totalPages = result.totalPages || 1;
        for (const txn of result.items) {
          rows.push({
            postingId: txn.postingId,
            accountId: account.accountId,
            accountName: account.displayName ?? `Account ${account.accountId}`,
            amount: txn.amount,
            memo: txn.memo || txn.message,
            settledAt: txn.settledAt,
            categoryId: null, // filled in below once we have the tag map
          });
        }
        page += 1;
      } while (page <= totalPages && page <= PAGES_PER_ACCOUNT);

      return rows;
    }),
  );

  const flat = perAccount.flat();

  const { data: tags } = await db
    .from("journal_entries")
    .select("account_id, posting_id, category_id")
    .eq("firm_id", firmId);

  const tagByKey = new Map((tags ?? []).map((t) => [`${t.account_id}:${t.posting_id}`, t.category_id]));

  for (const row of flat) {
    row.categoryId = tagByKey.get(`${row.accountId}:${row.postingId}`) ?? null;
  }

  return flat.sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());
}

/** Tags (or clears, if categoryId is null) one transaction with a Chart of Accounts category. */
export async function tagJournalEntry(
  db: DB,
  firmId: string,
  accountId: number,
  postingId: number,
  categoryId: string | null,
): Promise<void> {
  const { error } = await db.from("journal_entries").upsert(
    {
      firm_id: firmId,
      account_id: accountId,
      posting_id: postingId,
      category_id: categoryId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id,account_id,posting_id" },
  );

  if (error) throw new Error(error.message);
}
