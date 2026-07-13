import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountTransactions, getFirmAccounts } from "./treasury";
import type { Database } from "./supabase/types";

type DB = SupabaseClient<Database>;
type FirmRow = Database["public"]["Tables"]["firms"]["Row"];
type DepositRequest = Database["public"]["Tables"]["deposit_requests"]["Row"];

const DEPOSIT_CODE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes to actually send the payment
const MAX_CODE_ALLOCATION_ATTEMPTS = 20;

export class LedgerError extends Error {}

/** The one firm designated as custodian of pooled deposits. */
export async function getOperatorFirm(db: DB): Promise<FirmRow> {
  const { data, error } = await db.from("firms").select("*").eq("is_operator", true).maybeSingle();
  if (error || !data) {
    throw new LedgerError("No operator firm configured — set is_operator = true on one firm first.");
  }
  if (!data.deposit_account_id) {
    throw new LedgerError("Operator firm has no deposit_account_id set — see Settings.");
  }
  return data;
}

/** Makes sure a firm has operating + savings ledger rows before crediting/reading either. */
export async function ensureLedgerAccounts(db: DB, firmId: string): Promise<void> {
  await db
    .from("ledger_accounts")
    .upsert(
      [
        { firm_id: firmId, account_type: "operating" },
        { firm_id: firmId, account_type: "savings" },
      ],
      { onConflict: "firm_id,account_type", ignoreDuplicates: true },
    );
}

export async function getLedgerBalances(db: DB, firmId: string) {
  await ensureLedgerAccounts(db, firmId);
  const { data } = await db.from("ledger_accounts").select("*").eq("firm_id", firmId);
  const operating = data?.find((a) => a.account_type === "operating");
  const savings = data?.find((a) => a.account_type === "savings");
  return {
    operating: operating?.balance ?? 0,
    savings: savings?.balance ?? 0,
    savingsLocked: savings?.locked_balance ?? 0,
  };
}

/**
 * Reserves a random 2-digit code not currently claimed by another pending
 * request. Expires stale requests first so abandoned attempts free their
 * code up. Relies on the partial unique index on (cents_code) WHERE
 * status='pending' as the real safety net against a race between two
 * people requesting at the same instant — this loop is the happy path,
 * the DB constraint is what actually guarantees correctness.
 */
export async function createDepositRequest(
  db: DB,
  firmId: string,
  userId: string,
  wholeDollarAmount: number,
): Promise<DepositRequest & { command: string }> {
  if (!Number.isInteger(wholeDollarAmount) || wholeDollarAmount <= 0) {
    throw new LedgerError("Enter a whole dollar amount greater than zero.");
  }

  const operator = await getOperatorFirm(db);

  await db
    .from("deposit_requests")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const expiresAt = new Date(Date.now() + DEPOSIT_CODE_EXPIRY_MS).toISOString();

  for (let attempt = 0; attempt < MAX_CODE_ALLOCATION_ATTEMPTS; attempt++) {
    const code = Math.floor(Math.random() * 100);
    const { data, error } = await db
      .from("deposit_requests")
      .insert({
        firm_id: firmId,
        requested_by: userId,
        whole_dollar_amount: wholeDollarAmount,
        cents_code: code,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (!error && data) {
      const cents = String(code).padStart(2, "0");
      return {
        ...data,
        command: `/firm pay into ${operator.dc_firm_name} ${wholeDollarAmount}.${cents}`,
      };
    }
    // Unique violation on the pending-cents index — someone else has this
    // code right now. Try again with a different random one.
    if (error && !error.message.includes("duplicate key")) {
      throw new LedgerError(error.message);
    }
  }

  throw new LedgerError("All deposit codes are in use right now — try again in a minute.");
}

function centsOf(amount: string): number {
  const [, fraction = "00"] = amount.split(".");
  return parseInt(fraction.padEnd(2, "0").slice(0, 2), 10);
}

export interface CheckResult {
  matched: boolean;
  creditedAmount?: number;
  message: string;
}

/**
 * Looks for a real, positive, not-yet-claimed transaction on the
 * operator's deposit account whose cents match this request's code and
 * which settled after the request was created. On a match, credits the
 * requesting firm's operating balance by the full amount received (per
 * spec: "you're credited the full amount you send").
 */
export async function checkDepositRequest(db: DB, requestId: string, firmId: string): Promise<CheckResult> {
  const { data: request } = await db
    .from("deposit_requests")
    .select("*")
    .eq("id", requestId)
    .eq("firm_id", firmId) // never let a firm check another firm's request
    .single();

  if (!request) throw new LedgerError("Deposit request not found.");
  if (request.status === "matched") {
    return { matched: true, creditedAmount: request.credited_amount ?? undefined, message: "Already credited." };
  }
  if (request.status !== "pending" || new Date(request.expires_at) < new Date()) {
    return { matched: false, message: "This request expired — start a new deposit." };
  }

  const operator = await getOperatorFirm(db);
  const page = await getAccountTransactions(operator.treasury_jwt, operator.deposit_account_id!, 1, 50);

  const match = page.items.find(
    (txn) =>
      Number(txn.amount) > 0 &&
      centsOf(txn.amount) === request.cents_code &&
      new Date(txn.settledAt) >= new Date(request.created_at),
  );

  if (!match) {
    return { matched: false, message: "No matching payment seen yet — send it in-game, then check again." };
  }

  const creditedAmount = Number(match.amount);

  const { error: claimError } = await db
    .from("deposit_requests")
    .update({
      status: "matched",
      matched_posting_id: match.postingId,
      credited_amount: creditedAmount,
      matched_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending"); // can't double-claim a request either

  if (claimError) {
    // Unique violation on matched_posting_id means another request already
    // claimed this exact transaction first — don't credit twice.
    return { matched: false, message: "That payment was already matched to a different request." };
  }

  await ensureLedgerAccounts(db, firmId);
  const { data: current } = await db
    .from("ledger_accounts")
    .select("balance")
    .eq("firm_id", firmId)
    .eq("account_type", "operating")
    .single();

  await db
    .from("ledger_accounts")
    .update({ balance: (current?.balance ?? 0) + creditedAmount, updated_at: new Date().toISOString() })
    .eq("firm_id", firmId)
    .eq("account_type", "operating");

  return { matched: true, creditedAmount, message: `Credited $${creditedAmount.toFixed(2)}.` };
}

export interface Reconciliation {
  pooledTotal: number;
  realBalance: number;
  healthy: boolean;
}

/**
 * The non-negotiable safety check: what everyone's ledger balance adds up
 * to should never exceed what's actually sitting in the operator's real
 * account. If this ever comes back unhealthy, that's a real integrity
 * problem, not a UI bug — see the note on ledger_accounts in schema.sql.
 */
export async function getReconciliation(db: DB): Promise<Reconciliation> {
  const operator = await getOperatorFirm(db);
  const [{ data: allBalances }, accounts] = await Promise.all([
    db.from("ledger_accounts").select("balance"),
    getFirmAccounts(operator.treasury_jwt),
  ]);

  const pooledTotal = (allBalances ?? []).reduce((sum, a) => sum + a.balance, 0);
  const realBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return { pooledTotal, realBalance, healthy: pooledTotal <= realBalance };
}
