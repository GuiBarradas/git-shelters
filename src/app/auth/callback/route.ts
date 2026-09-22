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

import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";

import { ONCE, track } from "@/lib/analytics/track";
import { syncUser } from "@/lib/github/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?reason=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/error?reason=exchange_failed`, url.origin),
    );
  }

  // Kick the first sync (30-day backfill on a fresh account) without
  // holding the redirect: `after` runs once the response is sent. A user
  // who lands on the bunker a few seconds later sees bytes instead of
  // waiting up to 15 minutes for the cron.
  const user = data.user;
  const githubLogin =
    typeof user?.user_metadata?.user_name === "string" ? user.user_metadata.user_name : null;
  if (user) {
    after(async () => {
      const admin = createAdminClient();
      try {
        // A row created by this very sign-in is a signup, not a login.
        // Supabase stamps auth.users.created_at at creation, so "younger
        // than a minute" is the whole test.
        if (Date.now() - Date.parse(user.created_at) < 60_000) {
          await track(admin, user.id, "signup_completed", { time_to_complete_ms: null }, ONCE);
          await track(admin, user.id, "region_chosen", { region_id: "outage", was_default: true }, ONCE);
        }
        await syncUser(admin, { id: user.id, github_login: githubLogin });
      } catch (err) {
        Sentry.captureException(err, { tags: { user_id: user.id, entrypoint: "login" } });
      }
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
