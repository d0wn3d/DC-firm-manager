import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SetupForm } from "./SetupForm";

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.firm) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <p className="mb-2 font-mono text-[0.6875rem] tracking-[0.25em] text-brass-400 uppercase">
            Step 1 of 1
          </p>
          <h1 className="font-display text-4xl italic text-paper-100">
            Connect your firm
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-paper-300/70">
            Signed in as <span className="text-paper-100">{session.discordName}</span>.
            Stockbook reads your chest shops straight from DemocracyCraft&apos;s
            Treasury API — it needs a firm-scoped key to do that.
          </p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
