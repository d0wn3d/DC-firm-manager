import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountTransactions, type TreasuryAccount } from "./treasury";
import type { ChartAccount } from "./accounts";
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
 * A shop purchase reads, from the firm's account, as money leaving with a
 * memo describing a player selling items to the firm. Matched loosely
 * (just "sold ... to") plus a negative-amount check as a safety net, since
 * the exact wording Treasury sends for this isn't confirmed — worth
 * checking against a few real transaction memos and tightening the regex
 * if it's over- or under-matching.
 */
const MATERIALS_PURCHASE_PATTERN = /\bsold\b.{0,80}\bto\b/i;
const MATERIALS_CATEGORY_CODE = "6400"; // Materials & Supplies

/**
 * Fetches one account's transaction history. Page 1 has to be fetched
 * alone (it's the only way to learn totalPages), but every page after that
 * is fetched concurrently instead of one-at-a-time in a loop — same total
 * data, far less time spent waiting on sequential round trips to Treasury.
 */
async function fetchAccountRows(jwt: string, account: TreasuryAccount): Promise<JournalRow[]> {
  const first = await getAccountTransactions(jwt, account.accountId, 1, PAGE_SIZE);
  const totalPages = Math.min(first.totalPages || 1, PAGES_PER_ACCOUNT);

  const restPages =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => getAccountTransactions(jwt, account.accountId, i + 2, PAGE_SIZE)),
        )
      : [];

  const accountName = account.displayName ?? `Account ${account.accountId}`;

  return [first, ...restPages].flatMap((page) =>
    page.items.map((txn) => ({
      postingId: txn.postingId,
      accountId: account.accountId,
      accountName,
      amount: txn.amount,
      memo: txn.memo || txn.message,
      settledAt: txn.settledAt,
      categoryId: null as string | null,
    })),
  );
}

/**
 * Merges every Treasury account's transaction history into one
 * chronological feed and left-joins Stockbook's own category tags onto it
 * by (account_id, posting_id). Treasury stays the system of record for the
 * transaction itself — journal_entries only ever stores the label.
 *
 * Also auto-tags anything matching the materials-purchase pattern that
 * isn't tagged yet, so it never piles up in Uncategorized in the first
 * place. This runs on every read rather than at poll time, since the poll
 * job only syncs shop/stock data — transactions are always live-fetched,
 * there's no local mirror to hook a sync step into yet.
 */
export async function getJournalFeed(
  db: DB,
  jwt: string,
  firmId: string,
  accounts: TreasuryAccount[],
  categories: ChartAccount[],
): Promise<JournalRow[]> {
  const perAccount = await Promise.all(accounts.map((account) => fetchAccountRows(jwt, account)));
  const flat = perAccount.flat();

  const { data: tags } = await db
    .from("journal_entries")
    .select("account_id, posting_id, category_id")
    .eq("firm_id", firmId);

  const tagByKey = new Map((tags ?? []).map((t) => [`${t.account_id}:${t.posting_id}`, t.category_id]));
  for (const row of flat) {
    row.categoryId = tagByKey.get(`${row.accountId}:${row.postingId}`) ?? null;
  }

  const materialsCategory = categories.find((c) => c.code === MATERIALS_CATEGORY_CODE);
  if (materialsCategory) {
    const autoTargets = flat.filter(
      (row) => row.categoryId === null && Number(row.amount) < 0 && MATERIALS_PURCHASE_PATTERN.test(row.memo ?? ""),
    );
    if (autoTargets.length > 0) {
      await tagJournalEntries(
        db,
        firmId,
        autoTargets.map((r) => ({ accountId: r.accountId, postingId: r.postingId })),
        materialsCategory.id,
      );
      for (const row of autoTargets) row.categoryId = materialsCategory.id;
    }
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
  return tagJournalEntries(db, firmId, [{ accountId, postingId }], categoryId);
}

/** Same as tagJournalEntry but for many transactions in one round trip — what the Journal's bulk-select bar calls. */
export async function tagJournalEntries(
  db: DB,
  firmId: string,
  entries: Array<{ accountId: number; postingId: number }>,
  categoryId: string | null,
): Promise<void> {
  if (entries.length === 0) return;

  const rows = entries.map((e) => ({
    firm_id: firmId,
    account_id: e.accountId,
    posting_id: e.postingId,
    category_id: categoryId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from("journal_entries").upsert(rows, { onConflict: "firm_id,account_id,posting_id" });
  if (error) throw new Error(error.message);
}
