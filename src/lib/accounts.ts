import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

type DB = SupabaseClient<Database>;

export type ChartAccount = Database["public"]["Tables"]["chart_of_accounts"]["Row"];
export type AccountType = ChartAccount["type"];

export const ACCOUNT_TYPE_ORDER: AccountType[] = ["income", "expense", "asset", "liability", "equity"];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  income: "Income",
  expense: "Expense",
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
};

/**
 * Seeded once, the first time a firm opens Chart of Accounts. Trimmed to
 * what Stockbook can actually compute from Treasury transactions alone —
 * Payroll and Loan payments are expense *categories* here even though
 * there's no dedicated Payroll/Loans module yet, so a firm can still tag
 * transactions against them by hand until those modules exist.
 */
const DEFAULT_CATEGORIES: Array<{ code: string; name: string; type: AccountType }> = [
  { code: "4000", name: "Shop sales", type: "income" },
  { code: "4010", name: "Contract revenue", type: "income" },
  { code: "4900", name: "Other income", type: "income" },
  { code: "5000", name: "Inventory & supplies", type: "expense" },
  { code: "5100", name: "Payroll", type: "expense" },
  { code: "5200", name: "Rent & fees", type: "expense" },
  { code: "5300", name: "Loan payments", type: "expense" },
  { code: "5900", name: "Other expense", type: "expense" },
  { code: "1000", name: "Cash — Treasury", type: "asset" },
  { code: "1500", name: "Warehouse inventory", type: "asset" },
  { code: "2000", name: "Loans payable", type: "liability" },
  { code: "3000", name: "Owner's equity", type: "equity" },
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
