import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getJournalFeed, type JournalRow } from "./journal";
import { computeProfitAndLoss, computeTrialBalance } from "./reports";
import type { TreasuryAccount } from "./treasury";
import type { Database } from "./supabase/types";
import type { ChartAccount } from "./accounts";

type DB = SupabaseClient<Database>;

const SALES_CATEGORY_CODE = "4000";

export interface BusinessKPIs {
  rangeStart: string;
  rangeEnd: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  profitMargin: number | null; // %
  expenseRatio: number | null; // %
  averageTransactionValue: number | null; // $ per sale
  arpu: number | null; // $ per distinct buyer this period
  newCustomers: number;
  returningCustomers: number;
  newCustomerRate: number | null; // % of this period's buyers who are new
  revenueGrowthRate: number | null; // % vs previous period; null if no comparable period (Lifetime) or previous had no revenue
  revenuePerEmployee: number | null; // null if employee count unavailable
  debtToEquity: number | null; // as-of-now, not period-scoped — see getBusinessKPIs doc comment
  multiItemRepeatRate: number | null; // % of repeat buyers this period who bought 2+ distinct items — see doc comment, this is a proxy, not a true upsell/cross-sell rate
  employeeCount: number | null;
  /** How many of the underlying transactions we could actually attribute to a buyer/item — low relative to transaction count signals the memo parsing below isn't matching real data well. */
  attributedTransactionCount: number;
}

/** Matches "Player X bought x1 ITEM from ..." — same buyer-extraction idea as the auto-tag rules in lib/journal.ts, just pulling the leading name instead of testing for its presence. */
function extractBuyerKey(memo: string | null): string | null {
  if (!memo) return null;
  const match = /^(.+?)\s+bought\b/i.exec(memo);
  return match ? match[1].trim().toLowerCase() : null;
}

/** Best-effort item parse from the same memo shape — "bought x1 Iron Ingot from ..." -> "iron ingot". Confidence is lower than the buyer match since DCManager_Types.txt didn't give us a confirmed item-name template. */
function extractItemKey(memo: string | null): string | null {
  if (!memo) return null;
  const match = /\bbought\s+x?\d*\s*(.+?)\s+from\b/i.exec(memo);
  return match ? match[1].trim().toLowerCase() : null;
}

function inRange(row: JournalRow, startMs: number, endMs: number): boolean {
  const ms = new Date(row.settledAt).getTime();
  return ms >= startMs && ms <= endMs;
}

/**
 * Everything here is computed off one already-fetched journal feed — no
 * separate Treasury round trip per KPI. Two of these don't fit the
 * "period" framing the rest use, and are computed differently on purpose:
 *
 * - debtToEquity is a balance-sheet ratio (a balance AS OF a moment), not
 *   a flow over a period like revenue or expense are. Computing it from
 *   just this period's activity would be wrong — it's computed from the
 *   full fetched window up through rangeEnd, so it reads as "as of the end
 *   of the selected period" (today's date, for This Month/This Quarter/
 *   This Year/Lifetime; the period's actual end date for Last Month).
 * - multiItemRepeatRate is the closest honest proxy to "upsell/cross-sell
 *   rate" this data supports. A true upsell rate needs product tiers or
 *   bundle definitions (e.g. "upgraded from Iron to Diamond tier") that
 *   Stockbook doesn't track; this instead measures repeat buyers who
 *   purchased more than one distinct item this period, which is a real
 *   but different signal — breadth of purchase, not upgrade behavior.
 *
 * Both attribution helpers (buyer, item) depend on parsing the shop-sale
 * memo template, same as the auto-tag rules — bounded by the same
 * live-fetched window, and their accuracy is only as good as the memo
 * pattern actually matching. attributedTransactionCount is included so
 * it's visible in the UI if that stops being true.
 */
export async function getBusinessKPIs(
  db: DB,
  jwt: string,
  firmId: string,
  accounts: TreasuryAccount[],
  categories: ChartAccount[],
  employeeCount: number | null,
  rangeStart: Date,
  rangeEnd: Date,
  previousRange: [Date, Date] | null,
): Promise<BusinessKPIs> {
  const feed = await getJournalFeed(db, jwt, firmId, accounts, categories);
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  const pAndL = computeProfitAndLoss(feed, categories, rangeStart, rangeEnd);
  const previousPAndL = previousRange ? computeProfitAndLoss(feed, categories, previousRange[0], previousRange[1]) : null;

  const salesCategory = categories.find((c) => c.code === SALES_CATEGORY_CODE);
  const salesRowsInPeriod = feed.filter(
    (row) => inRange(row, startMs, endMs) && salesCategory && row.categoryId === salesCategory.id,
  );

  const averageTransactionValue =
    salesRowsInPeriod.length > 0
      ? salesRowsInPeriod.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0) / salesRowsInPeriod.length
      : null;

  // First-ever appearance per buyer across the WHOLE fetched window, not
  // just this period — needed to tell "new" from "returning" for buyers
  // active in period. Bounded by the same fetch window as everything
  // else: a genuinely returning customer whose real first purchase
  // predates the window will misclassify as new.
  const buyerFirstSeenMs = new Map<string, number>();
  const buyerItemsInPeriod = new Map<string, Set<string>>();
  let attributedTransactionCount = 0;

  for (const row of feed) {
    const buyerKey = extractBuyerKey(row.memo);
    if (!buyerKey) continue;
    attributedTransactionCount += 1;

    const ms = new Date(row.settledAt).getTime();
    const existing = buyerFirstSeenMs.get(buyerKey);
    if (existing === undefined || ms < existing) buyerFirstSeenMs.set(buyerKey, ms);

    if (ms >= startMs && ms <= endMs) {
      const itemKey = extractItemKey(row.memo);
      if (itemKey) {
        const items = buyerItemsInPeriod.get(buyerKey) ?? new Set<string>();
        items.add(itemKey);
        buyerItemsInPeriod.set(buyerKey, items);
      }
    }
  }

  // buyerItemsInPeriod only has entries for rows where item parsing also
  // succeeded, so the new/returning split below is derived from this
  // broader "has a buyer-attributed row in period" set instead, so a
  // buyer with an unparseable item name still counts.
  const allBuyersInPeriod = new Set<string>();
  for (const row of feed) {
    if (!inRange(row, startMs, endMs)) continue;
    const buyerKey = extractBuyerKey(row.memo);
    if (buyerKey) allBuyersInPeriod.add(buyerKey);
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  for (const buyerKey of allBuyersInPeriod) {
    const firstSeen = buyerFirstSeenMs.get(buyerKey);
    if (firstSeen !== undefined && firstSeen >= startMs) newCustomers += 1;
    else returningCustomers += 1;
  }

  let multiItemRepeatBuyers = 0;
  for (const buyerKey of returningCustomersKeys(allBuyersInPeriod, buyerFirstSeenMs, startMs)) {
    const items = buyerItemsInPeriod.get(buyerKey);
    if (items && items.size >= 2) multiItemRepeatBuyers += 1;
  }

  const trialBalance = computeTrialBalance(feed, categories, new Date(2020, 0, 1), rangeEnd);
  const totalLiabilities = trialBalance.lines.filter((l) => l.type === "liability").reduce((s, l) => s + l.balance, 0);
  const totalEquity = trialBalance.lines.filter((l) => l.type === "equity").reduce((s, l) => s + l.balance, 0);

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    totalRevenue: pAndL.totalIncome,
    totalExpense: pAndL.totalExpense,
    netIncome: pAndL.net,
    profitMargin: pAndL.totalIncome > 0 ? (pAndL.net / pAndL.totalIncome) * 100 : null,
    expenseRatio: pAndL.totalIncome > 0 ? (pAndL.totalExpense / pAndL.totalIncome) * 100 : null,
    averageTransactionValue,
    arpu: allBuyersInPeriod.size > 0 ? pAndL.totalIncome / allBuyersInPeriod.size : null,
    newCustomers,
    returningCustomers,
    newCustomerRate: allBuyersInPeriod.size > 0 ? (newCustomers / allBuyersInPeriod.size) * 100 : null,
    revenueGrowthRate:
      previousPAndL && previousPAndL.totalIncome > 0
        ? ((pAndL.totalIncome - previousPAndL.totalIncome) / previousPAndL.totalIncome) * 100
        : null,
    revenuePerEmployee: employeeCount && employeeCount > 0 ? pAndL.totalIncome / employeeCount : null,
    debtToEquity: totalEquity !== 0 ? totalLiabilities / totalEquity : null,
    multiItemRepeatRate: returningCustomers > 0 ? (multiItemRepeatBuyers / returningCustomers) * 100 : null,
    employeeCount,
    attributedTransactionCount,
  };
}

function returningCustomersKeys(allBuyersInPeriod: Set<string>, firstSeenMs: Map<string, number>, startMs: number): string[] {
  return [...allBuyersInPeriod].filter((key) => {
    const firstSeen = firstSeenMs.get(key);
    return firstSeen !== undefined && firstSeen < startMs;
  });
}
