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
 * Sums today's already-credited `github_sync` bytes for a user,
 * returning the room left under the daily cap.
 *
 * Today is the UTC calendar day of `now`, matching every other
 * date-bucketing convention in the project (analytics, gates, etc.).
 *
 * Caller is the sync entrypoint (server action or cron handler).
 * The caller passes the resulting number into `applyDailyCap`.
 */
export async function fetchDailyCapRemaining(
  admin: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const todayUtc = now.toISOString().slice(0, 10);
  const tomorrowUtc = new Date(
    Date.parse(`${todayUtc}T00:00:00Z`) + 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  const { data, error } = await admin
    .from("byte_transactions")
    .select("delta")
    .eq("user_id", userId)
    .eq("source", "github_sync")
    .gte("created_at", `${todayUtc}T00:00:00Z`)
    .lt("created_at", `${tomorrowUtc}T00:00:00Z`);

  if (error) {
    // Fail closed: if we cannot read the ledger, do not credit. But emit
    // a warning so dashboards distinguish "user actually hit the cap" from
    // "Supabase outage made us return 0" — they look identical to the
    // caller (zero capRemaining → no credits). A real outage spike here
    // is alertable; legitimate cap hits are not.
    Sentry.captureMessage(
      "fetchDailyCapRemaining: ledger query failed; failing closed",
      {
        level: "warning",
        tags: { component: "anti-cheese", user_id: userId },
        extra: { error: error.message },
      },
    );
    return 0;
  }

  const consumedToday = (data ?? []).reduce(
    (sum, row) => sum + (row.delta > 0 ? row.delta : 0),
    0,
  );

  const remaining = GITHUB_SYNC_DAILY_CAP - consumedToday;
  return remaining > 0 ? remaining : 0;
}
