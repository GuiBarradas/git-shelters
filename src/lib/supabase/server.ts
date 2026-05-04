/**
 * Server-side Supabase client (anon key).
 *
 * Use this in Server Components, Route Handlers, and Server Actions — anywhere
 * code runs on the Next.js server with access to the request cookies. It uses
 * the anon key, so RLS still applies, scoped to whatever user owns the
 * session cookie.
 *
 * The cookie plumbing is what makes auth work across Server Components: when
 * the user signs in via OAuth, Supabase writes session cookies; this client
 * reads them and the user is authenticated for the request.
 *
 * Do NOT use this for endpoints that need to bypass RLS. For that, see
 * ./admin.ts (service-role) — used only by the isolated public-profile
 * endpoint per ADR 0001.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll() can be called from Server Components, where cookie
            // mutation is not allowed. Middleware refreshes the session cookie
            // before reaching the Server Component, so this is safe to ignore
            // here. (Standard pattern from @supabase/ssr docs.)
          }
        },
      },
    },
  );
}
