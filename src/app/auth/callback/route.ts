/**
 * OAuth callback handler.
 *
 * After the user authorizes Git Shelters via GitHub, Supabase redirects here
 * with a `code` query param. We exchange that code for a session, which
 * writes session cookies on the response. Then we redirect the user to the
 * final destination (`next` query param, defaulting to home).
 *
 * Failure paths redirect to `/auth/error?reason=...` instead of throwing —
 * a 500 in OAuth is a worst-case UX, the user has no recourse and no
 * actionable info.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?reason=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/error?reason=exchange_failed`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
