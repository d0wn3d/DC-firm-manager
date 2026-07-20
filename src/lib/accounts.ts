import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { AccountType } from "./accountTypes";

export type { AccountType } from "./accountTypes";

type DB = SupabaseClient<Database>;

export type ChartAccount = Database["public"]["Tables"]["chart_of_accounts"]["Row"];
export type NormalBalance = ChartAccount["normal_balance"];

/**
 * DCManager's actual chart of accounts (from DCManager_Types.txt), mapped
 * 1:1 on code/name/type/normal balance/SYSTEM flag — "revenue" in their
 * file is "income" here, matching the type union and section labels this
 * app already uses.
 *
 * autoAssignOnly is NOT from DCManager's file — it's a Stockbook-specific
 * restriction on top of their convention. Only 4000 and 6400 get it, per
 * an explicit request: these two are populated only by the auto-tag rules
 * in lib/journal.ts, never manually picked from the Chart of Accounts UI
 * or the Journal's category pickers.
 */
const DEFAULT_CATEGORIES: Array<{
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isSystem: boolean;
  autoAssignOnly?: boolean;
}> = [
  // Assets
  { code: "1000", name: "Cash — Operating", type: "asset", normalBalance: "debit", isSystem: true },
  { code: "1050", name: "Cash Held In-Game", type: "asset", normalBalance: "debit", isSystem: true },
  { code: "1100", name: "Savings", type: "asset", normalBalance: "debit", isSystem: true },
  { code: "1200", name: "Accounts Receivable", type: "asset", normalBalance: "debit", isSystem: false },
  { code: "1260", name: "Guarantee Receivable", type: "asset", normalBalance: "debit", isSystem: true },
  { code: "1400", name: "Inventory — Goods & Materials", type: "asset", normalBalance: "debit", isSystem: false },
  { code: "1500", name: "Property — Plots", type: "asset", normalBalance: "debit", isSystem: false },
  { code: "1600", name: "Buildings & Improvements", type: "asset", normalBalance: "debit", isSystem: false },
  { code: "1700", name: "Equipment & Tools", type: "asset", normalBalance: "debit", isSystem: false },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability", normalBalance: "credit", isSystem: false },
  { code: "2100", name: "Wages Payable", type: "liability", normalBalance: "credit", isSystem: false },
  { code: "2200", name: "Taxes Payable", type: "liability", normalBalance: "credit", isSystem: false },
  { code: "2300", name: "Loans Payable", type: "liability", normalBalance: "credit", isSystem: false },
  { code: "2310", name: "Loans Payable — Guarantor", type: "liability", normalBalance: "credit", isSystem: true },
  // Equity
  { code: "3000", name: "Contributed Capital", type: "equity", normalBalance: "credit", isSystem: true },
  { code: "3100", name: "Distributions & Draws", type: "equity", normalBalance: "debit", isSystem: true },
  { code: "3900", name: "Opening Balance Equity", type: "equity", normalBalance: "credit", isSystem: false },
  // Income
  { code: "4000", name: "Sales Revenue", type: "income", normalBalance: "credit", isSystem: true, autoAssignOnly: true },
  { code: "4100", name: "Service Revenue", type: "income", normalBalance: "credit", isSystem: false },
  { code: "4200", name: "Rental Income", type: "income", normalBalance: "credit", isSystem: false },
  { code: "4800", name: "Gain on Sale of Assets", type: "income", normalBalance: "credit", isSystem: false },
  { code: "4900", name: "Yield Income", type: "income", normalBalance: "credit", isSystem: true },
  { code: "4950", name: "Uncategorized Income", type: "income", normalBalance: "credit", isSystem: true },
  // Expenses
  { code: "5000", name: "Payroll Expense", type: "expense", normalBalance: "debit", isSystem: true },
  { code: "5100", name: "Contractor Fees", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6000", name: "Platform & Transaction Fees", type: "expense", normalBalance: "debit", isSystem: true },
  { code: "6100", name: "Software Subscription", type: "expense", normalBalance: "debit", isSystem: true },
  { code: "6110", name: "Accounting & Bookkeeping Services", type: "expense", normalBalance: "debit", isSystem: true },
  { code: "6200", name: "Rent Expense", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6300", name: "Government Taxes & Fees", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6400", name: "Materials & Supplies", type: "expense", normalBalance: "debit", isSystem: false, autoAssignOnly: true },
  { code: "6500", name: "Marketing & Advertising", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6600", name: "Charity & Donations", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6700", name: "Legal & Professional Fees", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6750", name: "Interest Expense", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6800", name: "Fines & Penalties", type: "expense", normalBalance: "debit", isSystem: false },
  { code: "6900", name: "Uncategorized Expense", type: "expense", normalBalance: "debit", isSystem: true },
];

const AUTO_ASSIGN_ONLY_CODES = DEFAULT_CATEGORIES.filter((c) => c.autoAssignOnly).map((c) => c.code);

/**
 * Reconciles a firm's categories against DEFAULT_CATEGORIES rather than
 * only seeding once when a firm has zero rows — that one-shot approach
 * meant a firm that used Chart of Accounts before this list grew (or
 * before auto_assign_only/normal_balance existed) would never receive the
 * new codes or the retroactive lock on 4000/6400. This runs on every read;
 * it's a cheap no-op once a firm is caught up.
 *
 * Both writes below check their error explicitly and throw rather than
 * swallow it — an earlier version didn't, which meant a missing migration
 * (e.g. normal_balance/auto_assign_only columns not existing yet) failed
 * silently: the insert would error, nothing surfaced it, and the page just
 * rendered whatever was already there, looking like accounts had "gone
 * missing" rather than "never actually got inserted."
 */
async function ensureDefaultCategories(db: DB, firmId: string): Promise<void> {
  const { data: existing } = await db.from("chart_of_accounts").select("code").eq("firm_id", firmId);
  const existingCodes = new Set((existing ?? []).map((c) => c.code));
  const missing = DEFAULT_CATEGORIES.filter((c) => !existingCodes.has(c.code));

  if (missing.length > 0) {
    const { error } = await db.from("chart_of_accounts").insert(
      missing.map((c) => ({
        firm_id: firmId,
        code: c.code,
        name: c.name,
        type: c.type,
        normal_balance: c.normalBalance,
        is_system: c.isSystem,
        auto_assign_only: c.autoAssignOnly ?? false,
      })),
    );
    if (error) {
      throw new Error(
        `Couldn't seed default chart of accounts (${error.message}). If this mentions a missing column, MIGRATION_book_v2.sql hasn't been run yet.`,
      );
    }
  }

  if (AUTO_ASSIGN_ONLY_CODES.length > 0) {
    const { error } = await db
      .from("chart_of_accounts")
      .update({ auto_assign_only: true })
      .eq("firm_id", firmId)
      .in("code", AUTO_ASSIGN_ONLY_CODES)
      .eq("auto_assign_only", false);
    if (error) {
      throw new Error(`Couldn't patch auto_assign_only on existing categories (${error.message}).`);
    }
  }
}

/**
 * Every non-archived category for a firm, reconciling against the current
 * defaults first. Not cached — an earlier version wrapped the select in
 * unstable_cache, but Next 16 changed revalidateTag to require a second
 * (cacheLife profile) argument, and more importantly, the reconciliation
 * above can run from a Server Component's render path (not just Server
 * Actions), where Next's cache-mutation APIs aren't meant to be called at
 * all. Given this table is small and always queried by an indexed
 * firm_id, an uncached read here is not the actual bottleneck — see the
 * note on Supabase free-tier speed in CHANGES.md.
 */
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
  input: { code: string; name: string; type: AccountType; normalBalance?: NormalBalance },
): Promise<void> {
  if (!input.code.trim() || !input.name.trim()) {
    throw new Error("Code and name are required.");
  }

  const { error } = await db.from("chart_of_accounts").insert({
    firm_id: firmId,
    code: input.code.trim(),
    name: input.name.trim(),
    type: input.type,
    normal_balance: input.normalBalance ?? (input.type === "income" || input.type === "liability" || input.type === "equity" ? "credit" : "debit"),
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
  const { data: current } = await db
    .from("chart_of_accounts")
    .select("is_system, auto_assign_only, code")
    .eq("id", id)
    .eq("firm_id", firmId)
    .maybeSingle();

  if (current?.auto_assign_only) {
    throw new Error("This category is assigned automatically and can't be edited.");
  }
  // Name can still change on a SYSTEM category; the code can't, since
  // things like the auto-tag rules and the reconciliation in
  // ensureDefaultCategories() key off it.
  const nextCode = current?.is_system ? current.code : input.code.trim();

  const { error } = await db
    .from("chart_of_accounts")
    .update({ code: nextCode, name: input.name.trim() })
    .eq("id", id)
    .eq("firm_id", firmId);

  if (error) throw new Error(error.message);
}

/**
 * Soft delete only — a category may already be referenced by
 * journal_entries, and journal_entries.category_id is ON DELETE SET NULL
 * rather than cascading, so a hard delete would silently uncategorize
 * history. Archiving keeps the record intact and just hides it from new
 * tagging. auto_assign_only categories can't be archived at all — losing
 * 4000 or 6400 would silently turn off the auto-tag rules that depend on
 * them existing.
 */
export async function archiveCategory(db: DB, firmId: string, id: string): Promise<void> {
  const { data: current } = await db
    .from("chart_of_accounts")
    .select("auto_assign_only")
    .eq("id", id)
    .eq("firm_id", firmId)
    .maybeSingle();

  if (current?.auto_assign_only) {
    throw new Error("This category is assigned automatically and can't be archived.");
  }

  const { error } = await db.from("chart_of_accounts").update({ archived: true }).eq("id", id).eq("firm_id", firmId);
  if (error) throw new Error(error.message);
}
