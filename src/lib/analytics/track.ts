import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Server-side product analytics (ADR 0008). One closed union of events,
 * each with typed props, written to analytics_events with the
 * service-role client. Adding an event means editing this file, which
 * forces a review of what is collected.
 *
 * Privacy by construction: no prop type admits an email, a token or an
 * IP. `user_id` is our uuid, never the GitHub id. Everything here is
 * fire-and-forget: a failed insert is reported, never surfaced.
 *
 * Idempotency lives in the database: `dedupeKey` maps to a unique
 * constraint on (user_id, event_name, dedupe_key), so "first ever" and
 * "once per bucket" events cannot double-write under concurrent renders.
 */

export type AnalyticsEvent = {
  signup_completed: { time_to_complete_ms: number | null };
  region_chosen: { region_id: "outage"; was_default: true };
  first_build: { room_type: string; time_since_signup_ms: number };
  room_built: { room_type: string; level: number; bytes_spent: number };
  first_event_resolved: { event_id: string; choice: "a" | "b"; time_since_signup_ms: number };
  daily_event_resolved: { event_id: string; choice: "a" | "b"; outcome_delta_bytes: number };
  session_start: { days_since_signup: number; days_since_last_session: number | null };
  session_end: { duration_ms: number };
};

export type EventName = keyof AnalyticsEvent;

/** Key for events that happen once per account, ever. */
export const ONCE = "once";

type Admin = SupabaseClient<Database>;

/**
 * Inserts one event. Never throws. Returns false when a `dedupeKey`
 * collided (the event had already been recorded) or the insert failed.
 */
export async function track<E extends EventName>(
  admin: Admin,
  userId: string,
  event: E,
  props: AnalyticsEvent[E],
  dedupeKey: string | null = null,
): Promise<boolean> {
  const { data, error } = await admin
    .from("analytics_events")
    .upsert(
      { user_id: userId, event_name: event, props_json: props, dedupe_key: dedupeKey },
      { onConflict: "user_id,event_name,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    Sentry.captureMessage(`analytics insert failed: ${event}`, {
      level: "warning",
      extra: { error: error.message },
    });
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** Sessions are counted at most once per user per this bucket. */
export const SESSION_WINDOW_MS = 30 * 60_000;

/**
 * Records session_start at most once per 30-minute bucket. The previous
 * start is read only to derive days_since_last_session; the throttle
 * itself is the unique constraint, so concurrent renders cannot race.
 */
export async function trackSessionStart(
  admin: Admin,
  user: { id: string; created_at: string },
  now: Date = new Date(),
): Promise<boolean> {
  const { data: last } = await admin
    .from("analytics_events")
    .select("occurred_at")
    .eq("user_id", user.id)
    .eq("event_name", "session_start")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastAt = last ? Date.parse(last.occurred_at) : null;

  return track(
    admin,
    user.id,
    "session_start",
    {
      days_since_signup: daysBetween(Date.parse(user.created_at), now.getTime()),
      days_since_last_session: lastAt === null ? null : daysBetween(lastAt, now.getTime()),
    },
    String(Math.floor(now.getTime() / SESSION_WINDOW_MS)),
  );
}

export function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / 86_400_000);
}
