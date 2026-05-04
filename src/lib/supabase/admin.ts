/**
 * Admin Supabase client (service-role key, bypasses RLS).
 *
 * USE ONLY in server-only code that has a documented reason to bypass RLS.
 * Per ADR 0001, the only justified caller in the Public Alpha is the public
 * profile endpoint (`/api/u/[login]`), where read-only access to a strict
 * column whitelist is needed for visitors who are not authenticated as the
 * profile owner.
 *
 * NEVER import this from a Client Component or any code that gets bundled to
 * the browser. The service-role key is a master key for the database; leaking
 * it to the client is equivalent to publishing the database password.
 *
 * The service-role key lives in `SUPABASE_SERVICE_ROLE_KEY` (no
 * `NEXT_PUBLIC_` prefix), which Next.js exposes only to server code.
 *
 * Audit hint: any new caller of this module is a security-relevant change.
 * `git grep "from \"@/lib/supabase/admin\""` should return a short list.
 */

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() called in the browser — service-role keys must never reach the client.",
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // No session, no cookies — this client is stateless and trusted.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
