import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Full-access Supabase client using the service role key. This is how the
 * app actually reads/writes firms, stored Treasury JWTs, and shop rows —
 * RLS on those tables denies the anon/authenticated roles entirely (see
 * supabase/schema.sql), so authorization happens here, in application code,
 * by always scoping queries to a firm the caller has already been verified
 * to belong to. Never import this file into anything that ships to the
 * browser — the `server-only` import above will fail the build if you do.
 */
let cached: SupabaseClient<Database> | null = null;

export function createServiceClient(): SupabaseClient<Database> {
  if (cached) return cached;

  cached = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  return cached;
}
