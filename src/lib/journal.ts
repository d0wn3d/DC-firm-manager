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
 * Confirmed against real transaction memos: a ChestShop sale reads as
 * "Player X bought x1 ITEM from FIRM Corporate Account" (money into the
 * firm), and a purchase from a player reads as "Player X sold x1 ITEM from
 * FIRM Corporate Account" (money out). Matched on just "bought/sold ...
 * from" rather than requiring the full "Corporate Account" suffix too —
 * some real transactions weren't matching the stricter version, and the
 * amount-sign check below is still a safety net against false positives
 * from unrelated "sold ... from" phrasing.
 */
const AUTO_TAG_RULES: Array<{ pattern: RegExp; categoryCode: string; sign: "positive" | "negative" }> = [
  { pattern: /\bbought\b.+\bfrom\b/i, categoryCode: "4000", sign: "positive" }, // Sales Revenue
  { pattern: /\bsold\b.+\bfrom\b/i, categoryCode: "6400", sign: "negative" }, // Materials & Supplies
];

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
 * The tag lookup is scoped to postingIds actually present in this fetch
 * window (via `.in()`) rather than pulling the firm's entire tag history —
 * that history only grows, and every one of those older rows is
 * irrelevant here anyway since the feed itself is bounded to the same
 * live-fetched window.
 *
 * Also runs the auto-tag rules against anything not yet tagged, so shop
 * sales and materials purchases land on 4000/6400 without ever passing
 * through Uncategorized. Runs on every read rather than at poll time,
 * since the poll job only syncs shop/stock data — transactions are always
 * live-fetched, there's no local mirror to hook a sync step into yet.
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

  if (flat.length === 0) return [];

  const { data: tags } = await db
    .from("journal_entries")
    .select("account_id, posting_id, category_id")
    .eq("firm_id", firmId)
    .in(
      "posting_id",
      flat.map((r) => r.postingId),
    );

  const tagByKey = new Map((tags ?? []).map((t) => [`${t.account_id}:${t.posting_id}`, t.category_id]));
  for (const row of flat) {
    row.categoryId = tagByKey.get(`${row.accountId}:${row.postingId}`) ?? null;
  }

  for (const rule of AUTO_TAG_RULES) {
    const category = categories.find((c) => c.code === rule.categoryCode);
    if (!category) continue;

    const targets = flat.filter((row) => {
      if (row.categoryId !== null) return false;
      const amount = Number(row.amount) || 0;
      if (rule.sign === "positive" && amount < 0) return false;
      if (rule.sign === "negative" && amount >= 0) return false;
      return rule.pattern.test(row.memo ?? "");
    });

    if (targets.length > 0) {
      await tagJournalEntries(
        db,
        firmId,
        targets.map((r) => ({ accountId: r.accountId, postingId: r.postingId })),
        category.id,
      );
      for (const row of targets) row.categoryId = category.id;
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

/** Same as tagJournalEntry but for many transactions in one round trip — what the Journal's bulk-select bar (and the auto-tag rules above) call. */
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
