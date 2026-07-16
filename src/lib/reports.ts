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

/**
 * Income-statement-style rollup: every journal entry in range gets bucketed
 * by its category's type. Only income/expense categories feed the P&L —
 * asset/liability/equity-tagged entries (e.g. someone tagging a transfer as
 * "Cash — Treasury") are real categorizations, just not P&L-relevant, so
 * they're excluded here without being counted as uncategorized.
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
  const feed = await getJournalFeed(db, jwt, firmId, accounts);
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, CategoryTotal>();
  let uncategorizedTotal = 0;
  let uncategorizedCount = 0;

  for (const row of feed) {
    const settledMs = new Date(row.settledAt).getTime();
    if (settledMs < startMs || settledMs > endMs) continue;

    const amount = Number(row.amount) || 0;
    const category = row.categoryId ? categoryById.get(row.categoryId) : undefined;

    if (!category) {
      uncategorizedTotal += amount;
      uncategorizedCount += 1;
      continue;
    }
    if (category.type !== "income" && category.type !== "expense") continue;

    const magnitude = Math.abs(amount);
    const existing = totals.get(category.id);
    if (existing) {
      existing.total += magnitude;
      existing.count += 1;
    } else {
      totals.set(category.id, { categoryId: category.id, code: category.code, name: category.name, total: magnitude, count: 1 });
    }
  }

  const allTotals = [...totals.entries()].map(([id, t]) => ({ ...t, type: categoryById.get(id)!.type }));
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
