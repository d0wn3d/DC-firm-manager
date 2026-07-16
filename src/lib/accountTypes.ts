// No "server-only" import here on purpose — this file holds nothing but
// plain constants and a type, and needs to be safely importable as a
// *value* from client components (see chart-of-accounts/ChartOfAccounts.tsx).
// lib/accounts.ts re-exports AccountType from here for convenience, but the
// order/label constants live only in this file — don't duplicate them back
// into accounts.ts, or a client component importing them as values will
// pull "server-only" into the bundle again.

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export const ACCOUNT_TYPE_ORDER: AccountType[] = ["income", "expense", "asset", "liability", "equity"];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  income: "Income",
  expense: "Expense",
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
};
