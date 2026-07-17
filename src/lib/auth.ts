import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";
import type { Database } from "./supabase/types";

type FirmRow = Database["public"]["Tables"]["firms"]["Row"];

export interface SessionInfo {
  userId: string;
  discordName: string;
  avatarUrl: string | null;
  firm: (FirmRow & { role: "owner" | "member" }) | null;
}

/**
 * The one place that answers "who is this, and which firm do they belong
 * to". Every page and Server Action that touches firm/shop data should call
 * this first and scope its service-client queries to `firm.id` — that's
 * what stands in for RLS, since the shops/firms tables have none.
 *
 * Wrapped in React's cache() because every layout AND every page under
 * /dashboard calls this independently — dashboard/layout.tsx calls it once
 * for the shell, then whichever page.tsx is rendering calls it again for
 * its own redirect checks. Without memoizing, a single tab switch was
 * triggering 2+ full supabase.auth.getUser() round trips (a real network
 * call to Supabase Auth, not a local JWT decode) plus 2+ firm_members
 * lookups. cache() collapses all of that into one real check per request.
 */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const discordName: string =
    meta.full_name ?? meta.custom_claims?.global_name ?? meta.name ?? user.email ?? "there";
  const avatarUrl: string | null = meta.avatar_url ?? null;

  const db = createServiceClient();
  const { data: membership } = await db
    .from("firm_members")
    .select("role, firms(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  const firm = membership?.firms
    ? { ...(membership.firms as unknown as FirmRow), role: membership.role as "owner" | "member" }
    : null;

  return { userId: user.id, discordName, avatarUrl, firm };
});
