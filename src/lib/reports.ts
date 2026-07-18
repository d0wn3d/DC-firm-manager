import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getJournalFeed, type JournalRow } from "./journal";
import type { TreasuryAccount } from "./treasury";
import type { Database } from "./supabase/types";
import type { ChartAccount } from "./accounts";

type DB = SupabaseClient<Database>;

const UNCATEGORIZED_INCOME_CODE = "4950";
const UNCATEGORIZED_EXPENSE_CODE = "6900";
// The Treasury-observable side of every transaction — see getTrialBalance's
// doc comment for what this does and doesn't cover yet.
const CASH_LEDGER_CODE = "1050";

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

export interface TrialBalanceLine {
  code: string;
  name: string;
  type: string;
  normalBalance: "debit" | "credit";
  debit: number;
  credit: number;
  /** Signed so a positive number always means "in this account's normal direction" — a Loans Payable balance of $500 means $500 owed, not a raw credit total. */
  balance: number;
}

export interface TrialBalance {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  rangeStart: string;
  rangeEnd: string;
}

export interface BooksReport {
  profitAndLoss: ProfitAndLoss;
  trialBalance: TrialBalance;
}

/**
 * Income-statement-style rollup: every journal entry in range gets bucketed
 * by its category's type. Anything without an explicit tag lands on
 * "Uncategorized Income" or "Uncategorized Expense" (by the sign of the
 * amount) rather than being dropped from the report entirely — that's how
 * DCManager's own chart of accounts handles it too (see the 4950/6900
 * system categories), and it means Net Income is always a real total
 * instead of silently excluding whatever hasn't been tagged yet. In
 * practice most shop activity never reaches Uncategorized at all now,
 * since the auto-tag rules in lib/journal.ts catch it on the way in.
 */
function computeProfitAndLoss(
  feed: JournalRow[],
  categories: ChartAccount[],
  rangeStart: Date,
  rangeEnd: Date,
): ProfitAndLoss {
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

/**
 * Real double-entry, built on top of the single category tag already
 * stored per transaction: the Treasury-observed cash movement is always
 * one leg (1050 Cash Held In-Game), and whatever category the transaction
 * is tagged with is the other leg, in the opposite direction. A shop sale
 * is Debit Cash / Credit Sales Revenue; a materials purchase is Debit
 * Materials & Supplies / Credit Cash — same construction QuickBooks-style
 * "bank feed categorization" tools use. Because every entry is exactly
 * one debit and one credit of equal size, total debits always equal total
 * credits by construction — `balanced` is really just a build-time sanity
 * check, not something that can fail from normal use.
 *
 * This only covers the Treasury side. 1000 (Cash — Operating) and 1100
 * (Savings) — the money held in Stockbook's own custodial ledger, not
 * in-game — aren't wired into this yet; a deposit today still just
 * credits ledger_accounts.balance directly (see lib/ledger.ts) without
 * producing a journal entry here. Bringing those into the same double-entry
 * books is a real follow-up, not a small tweak — a deposit is actually a
 * transfer (money leaving the depositor's Treasury account, landing in
 * Stockbook's custodial balance), which needs its own auto-tag rule rather
 * than being treated as income or expense.
 */
function computeTrialBalance(feed: JournalRow[], categories: ChartAccount[], rangeStart: Date, rangeEnd: Date): TrialBalance {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const uncategorizedIncome = categories.find((c) => c.code === UNCATEGORIZED_INCOME_CODE);
  const uncategorizedExpense = categories.find((c) => c.code === UNCATEGORIZED_EXPENSE_CODE);
  const cashAccount = categories.find((c) => c.code === CASH_LEDGER_CODE);

  const lines = new Map<string, TrialBalanceLine>();

  function addLine(category: ChartAccount, debit: number, credit: number) {
    const existing = lines.get(category.code);
    if (existing) {
      existing.debit += debit;
      existing.credit += credit;
    } else {
      lines.set(category.code, {
        code: category.code,
        name: category.name,
        type: category.type,
        normalBalance: category.normal_balance,
        debit,
        credit,
        balance: 0,
      });
    }
  }

  if (cashAccount) {
    for (const row of feed) {
      const settledMs = new Date(row.settledAt).getTime();
      if (settledMs < startMs || settledMs > endMs) continue;

      const amount = Number(row.amount) || 0;
      let category = row.categoryId ? categoryById.get(row.categoryId) : undefined;
      if (!category) category = amount >= 0 ? uncategorizedIncome : uncategorizedExpense;
      if (!category) continue;

      const magnitude = Math.abs(amount);
      if (amount >= 0) {
        addLine(cashAccount, magnitude, 0);
        addLine(category, 0, magnitude);
      } else {
        addLine(category, magnitude, 0);
        addLine(cashAccount, 0, magnitude);
      }
    }
  }

  for (const line of lines.values()) {
    line.balance = line.normalBalance === "debit" ? line.debit - line.credit : line.credit - line.debit;
  }

  const sortedLines = [...lines.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = sortedLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = sortedLines.reduce((s, l) => s + l.credit, 0);

  return {
    lines: sortedLines,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  };
}

/** Fetches the journal feed once and computes both reports from it — avoids doubling Treasury calls when a caller wants both, which Reports.tsx always does. */
export async function getBooksReport(
  db: DB,
  jwt: string,
  firmId: string,
  accounts: TreasuryAccount[],
  categories: ChartAccount[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BooksReport> {
  const feed = await getJournalFeed(db, jwt, firmId, accounts, categories);
  return {
    profitAndLoss: computeProfitAndLoss(feed, categories, rangeStart, rangeEnd),
    trialBalance: computeTrialBalance(feed, categories, rangeStart, rangeEnd),
  };
}

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
  return computeProfitAndLoss(feed, categories, rangeStart, rangeEnd);
}

export async function getTrialBalance(
  db: DB,
  jwt: string,
  firmId: string,
  accounts: TreasuryAccount[],
  categories: ChartAccount[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<TrialBalance> {
  const feed = await getJournalFeed(db, jwt, firmId, accounts, categories);
  return computeTrialBalance(feed, categories, rangeStart, rangeEnd);
}
