import * as Sentry from "@sentry/nextjs";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { applyDailyCap } from "@/lib/anti-cheese/apply-daily-cap";
import { fetchDailyCapRemaining } from "@/lib/anti-cheese/daily-cap-query";
import { rejectBotEvents } from "@/lib/anti-cheese/reject-bot-events";
import { eventsToCredits, fetchUserEvents } from "@/lib/github/events";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vercel Cron entrypoint — see ADR 0005.
 *
 * Schedule: every 15 minutes (cron expression in vercel.json).
 *
 * Auth: shared `CRON_SECRET` via `Authorization: Bearer <secret>` header,
 * which Vercel injects automatically on cron invocations. Manual hits to
 * this URL without the header are 401'd.
 *
 * Per-user iteration: one `credit_bytes_tx_batch` RPC per user, all of
 * that user's pending PushEvent credits in a single round-trip. A failure
 * for one user is captured to Sentry but does not abort the whole run —
 * one user's bad data should not starve the others.
 *
 * Idempotency: guaranteed by the unique constraint on byte_transactions
 * (ADR 0004). Two overlapping cron runs, or a cron run overlapping with
 * an on-demand "Sync" button, both fire ON CONFLICT DO NOTHING per row.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYNC_FETCH_LIMIT = 30;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get("authorization");

  if (!expected) {
    Sentry.captureMessage("CRON_SECRET not configured", "error");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  if (!isAuthorizedCronRequest(got, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  Sentry.addBreadcrumb({
    category: "cron",
    message: "sync cron started",
    level: "info",
  });

  const admin = createAdminClient();

  // ADR 0005 §"Which users does the cron iterate?":
  // For the Public Alpha we iterate every non-deleted user. Add a
  // last_seen_at filter when counts justify it.
  const { data: users, error: usersErr } = await admin
    .from("users")
    .select("id, github_login")
    .is("deleted_at", null);

  if (usersErr) {
    Sentry.captureException(usersErr);
    return NextResponse.json({ error: "users fetch failed" }, { status: 500 });
  }

  const results = {
    total: users?.length ?? 0,
    synced: 0,
    skipped: 0,
    failed: 0,
  };

  for (const user of users ?? []) {
    try {
      if (!user.github_login) {
        results.skipped += 1;
        continue;
      }

      // Slicing here is belt-and-suspenders: GitHub's `/users/{u}/events/public`
      // returns 30 per page by default, so we already get a single page. If
      // pagination is added to fetchUserEvents later, this slice becomes the
      // real ceiling per ADR 0005 §"Fetch policy".
      const events = rejectBotEvents(
        (await fetchUserEvents(user.github_login)).slice(0, SYNC_FETCH_LIMIT),
      );
      const proposed = eventsToCredits(events);

      if (proposed.length === 0) {
        results.skipped += 1;
        continue;
      }

      const capRemaining = await fetchDailyCapRemaining(admin, user.id);
      const credits = applyDailyCap(proposed, capRemaining);

      if (credits.length === 0) {
        results.skipped += 1;
        continue;
      }

      const { error: rpcErr } = await admin.rpc("credit_bytes_tx_batch", {
        p_user_id: user.id,
        p_credits: credits,
      });

      if (rpcErr) {
        throw rpcErr;
      }

      results.synced += 1;
    } catch (err) {
      // Per-user failure isolation — surface to Sentry, keep going.
      Sentry.withScope((scope) => {
        scope.setTag("user_id", user.id);
        scope.setTag("github_login", user.github_login ?? "unknown");
        Sentry.captureException(err);
      });
      results.failed += 1;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  Sentry.addBreadcrumb({
    category: "cron",
    message: `sync cron finished: ${JSON.stringify(results)} in ${elapsedMs}ms`,
    level: "info",
  });

  return NextResponse.json({ ok: true, elapsedMs, ...results });
}

/**
 * Constant-time comparison of the `Authorization` header against the
 * expected `Bearer ${CRON_SECRET}`. Rejects early on length mismatch
 * (length itself is not a secret) and uses `timingSafeEqual` on equal
 * lengths to defeat timing side-channels. Overkill for a 256-bit hex
 * secret but free and matches industry baseline for cron auth.
 */
function isAuthorizedCronRequest(got: string | null, expected: string): boolean {
  if (got === null) return false;

  const expectedHeader = `Bearer ${expected}`;
  const gotBuf = Buffer.from(got);
  const expectedBuf = Buffer.from(expectedHeader);

  if (gotBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(gotBuf, expectedBuf);
}
