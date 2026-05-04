/**
 * Auth session refresh proxy (Next 16 file convention).
 *
 * Runs on every matching request. Touches Supabase `auth.getUser()` so that
 * expired session cookies are refreshed transparently — without this, users
 * get silently logged out at unpredictable moments.
 *
 * This is the canonical Supabase SSR pattern. It does not authorize anything
 * by itself — it just keeps the session token fresh. Authorization is the
 * job of individual Server Components / Route Handlers.
 *
 * Renamed from `middleware.ts` to `proxy.ts` per Next 16 deprecation:
 *   https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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
  // Skip static assets, Next internals, API routes, RSC payloads, and the
  // Sentry tunnel route. Each exclusion reasoned:
  //   _next/static, _next/image, favicon, image extensions: never auth-bound,
  //     and skipping them avoids hitting Supabase Auth on every static asset.
  //   _next/data: RSC payloads — server already validated the auth context
  //     when rendering the page, no need to refresh on every payload fetch.
  //   api/: route handlers manage their own auth; refreshing the cookie here
  //     is wasted work and adds a Supabase round-trip per API call.
  //   monitoring: the Sentry tunnel route (next.config.ts → tunnelRoute).
  //     Every error/replay beacon would otherwise trigger an auth.getUser().
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|monitoring|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
