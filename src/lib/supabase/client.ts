/**
 * Browser-side Supabase client.
 *
 * Use this in Client Components, hooks, and event handlers — anywhere code
 * runs in the user's browser. It uses the anon key, so RLS applies normally
 * (the user can only read/write their own rows).
 *
 * Do NOT use this on the server. The server has its own client that knows how
 * to read/write Next.js cookies (see ./server.ts).
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
