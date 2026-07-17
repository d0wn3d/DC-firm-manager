import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getJournalFeed } from "./journal";
import type { TreasuryAccount } from "./treasury";
import type { Database } from "./supabase/types";
import type { ChartAccount } from "./accounts";

type DB = SupabaseClient<Database>;

export interface CategoryTotal {
  categoryId: string;
  code: string;
  name: string;
  total: number;
  count: number;
}

export interface ProfitAndLoss {
  income: CategoryTotal[];
  expense: CategoryTotal[];
  totalIncome: number;
  totalExpense: number;
  net: number;
  uncategorizedTotal: number;
  uncategorizedCount: number;
  rangeStart: string;
  rangeEnd: string;
}

const UNCATEGORIZED_INCOME_CODE = "4950";
const UNCATEGORIZED_EXPENSE_CODE = "6900";

/**
 * Income-statement-style rollup: every journal entry in range gets bucketed
 * by its category's type. Anything without an explicit tag lands on
 * "Uncategorized Income" or "Uncategorized Expense" (by the sign of the
 * amount) rather than being dropped from the report entirely — that's how
 * DCManager's own chart of accounts handles it too (see the 4950/6900
 * system categories), and it means Net Income is always a real total
 * instead of silently excluding whatever hasn't been tagged yet.
 * uncategorizedCount/uncategorizedTotal still track just those two
 * buckets, as the nudge to go reclassify them into something more useful.
 */
export async function getProfitAndLoss(
  db: DB,
  jwt: string,
  firmId: string,
  accounts: TreasuryAccount[],
  categories: ChartAccount[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<ProfitAndLoss> {
  const feed = await getJournalFeed(db, jwt, firmId, accounts, categories);
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const uncategorizedIncome = categories.find((c) => c.code === UNCATEGORIZED_INCOME_CODE);
  const uncategorizedExpense = categories.find((c) => c.code === UNCATEGORIZED_EXPENSE_CODE);

  const totals = new Map<string, CategoryTotal & { type: string }>();
  let uncategorizedTotal = 0;
  let uncategorizedCount = 0;

  function addTo(category: ChartAccount, amount: number) {
    const magnitude = Math.abs(amount);
    const existing = totals.get(category.id);
    if (existing) {
      existing.total += magnitude;
      existing.count += 1;
    } else {
      totals.set(category.id, {
        categoryId: category.id,
        code: category.code,
        name: category.name,
        type: category.type,
        total: magnitude,
        count: 1,
      });
    }
  }

  for (const row of feed) {
    const settledMs = new Date(row.settledAt).getTime();
    if (settledMs < startMs || settledMs > endMs) continue;

    const amount = Number(row.amount) || 0;
    let category = row.categoryId ? categoryById.get(row.categoryId) : undefined;

    if (!category) {
      uncategorizedTotal += amount;
      uncategorizedCount += 1;
      category = amount >= 0 ? uncategorizedIncome : uncategorizedExpense;
      // Defaults were never seeded, or got archived — exclude, same as
      // the old behavior, rather than crash on a missing category.
      if (!category) continue;
    }

    if (category.type !== "income" && category.type !== "expense") continue;
    addTo(category, amount);
  }

  const allTotals = [...totals.values()];
  const income = allTotals.filter((t) => t.type === "income").sort((a, b) => b.total - a.total);
  const expense = allTotals.filter((t) => t.type === "expense").sort((a, b) => b.total - a.total);
  const totalIncome = income.reduce((s, t) => s + t.total, 0);
  const totalExpense = expense.reduce((s, t) => s + t.total, 0);

  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    uncategorizedTotal,
    uncategorizedCount,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  };
}
