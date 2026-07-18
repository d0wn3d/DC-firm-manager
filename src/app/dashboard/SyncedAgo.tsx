"use client";

import { useEffect, useState } from "react";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * timeAgo() used to run once, server-side, at render time — the text was
 * then frozen in the HTML until the next full server round trip (a manual
 * page refresh, or SyncButton's router.refresh() right after a sync). This
 * takes the raw ISO timestamp instead of a pre-formatted string and
 * recomputes on a timer, so "Synced 3m ago" keeps counting up on its own
 * without the person needing to do anything.
 */
export function SyncedAgo({ iso }: { iso: string | null }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-mono text-xs text-paper-300/50">Synced {timeAgo(iso)}</span>;
}
