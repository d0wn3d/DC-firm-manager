import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Session-aware Supabase client for Server Components, Server Actions and
 * Route Handlers. This only knows who's logged in — it does NOT bypass RLS,
 * and the app never grants the anon/authenticated role direct access to the
 * firms/shops tables (see supabase/schema.sql). Use this to read
 * `auth.getUser()`, then hand off to service.ts for the actual data query.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component during render — safe to ignore
            // because middleware.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
