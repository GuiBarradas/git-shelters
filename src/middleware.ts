/**
 * Auth session refresh middleware.
 *
 * Runs on every matching request. Touches Supabase `auth.getUser()` so that
 * expired session cookies are refreshed transparently — without this, users
 * get silently logged out at unpredictable moments.
 *
 * This is the canonical Supabase SSR pattern. It does not authorize anything
 * by itself — it just keeps the session token fresh. Authorization is the
 * job of individual Server Components / Route Handlers.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // The act of calling getUser() is what refreshes the session cookie. The
  // user value itself is unused here — we just need the side effect.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets and Next internals. Match every other path.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
