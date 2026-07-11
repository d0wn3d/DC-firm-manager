"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncNow } from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await syncNow();
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-sm border border-brass-400/40 px-3 py-1.5 font-mono text-xs tracking-wide text-brass-300 uppercase transition hover:bg-brass-400/10 disabled:opacity-50"
    >
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
