import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { AccountType } from "./accountTypes";

export type { AccountType } from "./accountTypes";

type DB = SupabaseClient<Database>;

export type ChartAccount = Database["public"]["Tables"]["chart_of_accounts"]["Row"];

/**
 * Seeded once, the first time a firm opens Chart of Accounts. Matches
 * DCManager's own chart of accounts (codes and names) rather than the
 * trimmed-down version this shipped with originally — including
 * "Uncategorized Income" (4950) and "Uncategorized Expense" (6900),
 * which lib/reports.ts falls back to for anything left untagged, the same
 * way DCManager's own P&L never just drops untagged activity.
 * Payroll/Loans/Contracts categories exist here even though there's no
 * dedicated module for any of them yet, so a firm can tag transactions
 * against them by hand in the meantime.
 */
const DEFAULT_CATEGORIES: Array<{ code: string; name: string; type: AccountType }> = [
  // Assets
  { code: "1000", name: "Cash — Operating", type: "asset" },
  { code: "1050", name: "Cash Held In-Game", type: "asset" },
  { code: "1100", name: "Savings", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1260", name: "Guarantee Receivable", type: "asset" },
  { code: "1400", name: "Inventory — Goods & Materials", type: "asset" },
  { code: "1500", name: "Property — Plots", type: "asset" },
  { code: "1600", name: "Buildings & Improvements", type: "asset" },
  { code: "1700", name: "Equipment & Tools", type: "asset" },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Wages Payable", type: "liability" },
  { code: "2200", name: "Taxes Payable", type: "liability" },
  { code: "2300", name: "Loans Payable", type: "liability" },
  { code: "2310", name: "Loans Payable — Guarantor", type: "liability" },
  // Equity
  { code: "3000", name: "Contributed Capital", type: "equity" },
  { code: "3100", name: "Distributions & Draws", type: "equity" },
  { code: "3900", name: "Opening Balance Equity", type: "equity" },
  // Income
  { code: "4000", name: "Sales Revenue", type: "income" },
  { code: "4100", name: "Service Revenue", type: "income" },
  { code: "4200", name: "Rental Income", type: "income" },
  { code: "4800", name: "Gain on Sale of Assets", type: "income" },
  { code: "4900", name: "Yield Income", type: "income" },
  { code: "4950", name: "Uncategorized Income", type: "income" },
  // Expenses
  { code: "5000", name: "Payroll Expense", type: "expense" },
  { code: "5100", name: "Contractor Fees", type: "expense" },
  { code: "6000", name: "Platform & Transaction Fees", type: "expense" },
  { code: "6100", name: "Software Subscription", type: "expense" },
  { code: "6110", name: "Accounting & Bookkeeping Services", type: "expense" },
  { code: "6200", name: "Rent Expense", type: "expense" },
  { code: "6300", name: "Government Taxes & Fees", type: "expense" },
  { code: "6400", name: "Materials & Supplies", type: "expense" },
  { code: "6500", name: "Marketing & Advertising", type: "expense" },
  { code: "6600", name: "Charity & Donations", type: "expense" },
  { code: "6700", name: "Legal & Professional Fees", type: "expense" },
  { code: "6750", name: "Interest Expense", type: "expense" },
  { code: "6800", name: "Fines & Penalties", type: "expense" },
  { code: "6900", name: "Uncategorized Expense", type: "expense" },
];

async function ensureDefaultCategories(db: DB, firmId: string): Promise<void> {
  const { count } = await db
    .from("chart_of_accounts")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId);

  if (count && count > 0) return;

  await db.from("chart_of_accounts").insert(
    DEFAULT_CATEGORIES.map((c) => ({
      firm_id: firmId,
      code: c.code,
      name: c.name,
      type: c.type,
      is_system: true,
    })),
  );
}

/** Every non-archived category for a firm, seeding the defaults first if this is a first visit. */
export async function getChartOfAccounts(db: DB, firmId: string): Promise<ChartAccount[]> {
  await ensureDefaultCategories(db, firmId);

  const { data } = await db
    .from("chart_of_accounts")
    .select("*")
    .eq("firm_id", firmId)
    .eq("archived", false)
    .order("code");

  return data ?? [];
}

export async function createCategory(
  db: DB,
  firmId: string,
  input: { code: string; name: string; type: AccountType },
): Promise<void> {
  if (!input.code.trim() || !input.name.trim()) {
    throw new Error("Code and name are required.");
  }

  const { error } = await db.from("chart_of_accounts").insert({
    firm_id: firmId,
    code: input.code.trim(),
    name: input.name.trim(),
    type: input.type,
  });

  if (error) {
    throw new Error(error.message.includes("duplicate key") ? `Code ${input.code} is already in use.` : error.message);
  }
}

export async function renameCategory(
  db: DB,
  firmId: string,
  id: string,
  input: { code: string; name: string },
): Promise<void> {
  const { error } = await db
    .from("chart_of_accounts")
    .update({ code: input.code.trim(), name: input.name.trim() })
    .eq("id", id)
    .eq("firm_id", firmId);

  if (error) throw new Error(error.message);
}

/**
 * Soft delete only — a category may already be referenced by
 * journal_entries, and journal_entries.category_id is ON DELETE SET NULL
 * rather than cascading, so a hard delete would silently uncategorize
 * history. Archiving keeps the record intact and just hides it from new
 * tagging.
 */
export async function archiveCategory(db: DB, firmId: string, id: string): Promise<void> {
  const { error } = await db
    .from("chart_of_accounts")
    .update({ archived: true })
    .eq("id", id)
    .eq("firm_id", firmId);

  if (error) throw new Error(error.message);
}
