import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase instance. Only used to kick off the Discord OAuth
 * redirect from the login button — every read/write of firm or shop data
 * happens server-side (see server.ts / service.ts) so the anon key never
 * touches anything sensitive.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
