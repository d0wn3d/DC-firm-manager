import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFirmEmployees, TreasuryAuthError } from "@/lib/treasury";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.firm) redirect("/setup");

  let employees: Awaited<ReturnType<typeof getFirmEmployees>> = [];
  let error: string | null = null;

  try {
    employees = await getFirmEmployees(session.firm.treasury_jwt);
  } catch (err) {
    error = err instanceof TreasuryAuthError
      ? "Treasury token needs reconnecting — see Settings."
      : "Couldn't reach the Treasury API just now.";
  }

  if (error) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">{error}</p>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="ledger-sheet rounded-sm border border-ink-700 p-10 text-center">
        <p className="font-display text-xl italic text-ink-900">No employees on record</p>
      </div>
    );
  }

  return (
    <div className="ledger-sheet overflow-hidden rounded-sm border border-ink-700">
      <div className="hidden gap-4 border-b border-ink-900/10 px-5 py-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-ink-700/60 uppercase sm:grid sm:grid-cols-[1.3fr_1fr_1fr]">
        <span>Player</span>
        <span>Role</span>
        <span className="text-right">Joined</span>
      </div>
      <ul>
        {employees.map((emp) => (
          <li
            key={emp.playerUuid}
            className="flex flex-col gap-1.5 border-b border-ink-900/10 px-5 py-3.5 last:border-b-0 sm:grid sm:grid-cols-[1.3fr_1fr_1fr] sm:items-center sm:gap-4"
          >
            <p className="text-sm font-medium text-ink-900">{emp.playerName ?? emp.playerUuid}</p>
            <p className="font-mono text-xs text-ink-700/60">{emp.roleName ?? "—"}</p>
            <p className="text-right font-mono text-xs text-ink-700/60">
              {emp.joinedAt ? new Date(emp.joinedAt).toLocaleDateString() : "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
