import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Daily cap on bytes credited from `source = github_sync`.
 * The number lives in code (not env) because it is product policy,
 * not deployment configuration. Raise via PR + ADR errata only.
 */
export const GITHUB_SYNC_DAILY_CAP = 100;

/**
 * Total lifetime bytes a user may receive from the one-time 30-day
 * backfill (`source = backfill`). Same anti-cheese reasoning as the daily
 * cap: fabricated history yields at most this much, once. The number is
 * the top of the GDD's expected 100–500 arrival range.
 */
export const BACKFILL_CAP = 500;

/**
 * Sums today's already-credited `github_sync` bytes for a user,
 * returning the room left under the daily cap.
 *
 * Today is the UTC calendar day of `now`, matching every other
 * date-bucketing convention in the project (analytics, gates, etc.).
 */
export async function fetchDailyCapRemaining(
  admin: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const todayUtc = now.toISOString().slice(0, 10);
  const tomorrowUtc = new Date(Date.parse(`${todayUtc}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return fetchCapRemaining(admin, userId, "github_sync", GITHUB_SYNC_DAILY_CAP, {
    from: `${todayUtc}T00:00:00Z`,
    to: `${tomorrowUtc}T00:00:00Z`,
  });
}

/** Room left under the lifetime backfill cap (retries of a failed backfill share it). */
export function fetchBackfillCapRemaining(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  return fetchCapRemaining(admin, userId, "backfill", BACKFILL_CAP);
}

/**
 * Generic "cap minus positive credits already in the ledger" query.
 * The caller passes the resulting number into `applyDailyCap`.
 */
async function fetchCapRemaining(
  admin: SupabaseClient<Database>,
  userId: string,
  source: string,
  cap: number,
  window?: { from: string; to: string },
): Promise<number> {
  let query = admin
    .from("byte_transactions")
    .select("delta")
    .eq("user_id", userId)
    .eq("source", source);
  if (window) {
    query = query.gte("created_at", window.from).lt("created_at", window.to);
  }
  const { data, error } = await query;

  if (error) {
    // Fail closed: if we cannot read the ledger, do not credit. But emit
    // a warning so dashboards distinguish "user actually hit the cap" from
    // "Supabase outage made us return 0" — they look identical to the
    // caller (zero capRemaining → no credits). A real outage spike here
    // is alertable; legitimate cap hits are not.
    Sentry.captureMessage("fetchCapRemaining: ledger query failed; failing closed", {
      level: "warning",
      tags: { component: "anti-cheese", user_id: userId, source },
      extra: { error: error.message },
    });
    return 0;
  }

  const consumed = (data ?? []).reduce((sum, row) => sum + (row.delta > 0 ? row.delta : 0), 0);
  const remaining = cap - consumed;
  return remaining > 0 ? remaining : 0;
}
