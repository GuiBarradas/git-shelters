import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { parseOption, type DailyEventOption } from "@/lib/events/option";
import type { Database } from "@/lib/supabase/database.types";

export type DailyEventView = {
  title: string;
  narrative: string;
  options: { a: DailyEventOption; b: DailyEventOption };
  /** Today's resolution, if the player already decided. */
  resolved: { choice: "a" | "b"; outcome: DailyEventOption } | null;
};

/**
 * Today's Daily Event for the player (ADR 0002): the id comes from the
 * same `pick_daily_event` SQL function the resolve RPC uses, then the
 * catalog row and today's outcome (if any) are read in parallel.
 *
 * An empty pool is a P1 by design — it means nobody can play today — so
 * it is reported to Sentry and the caller renders nothing.
 */
export async function fetchDailyEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  todayUtc: string,
): Promise<DailyEventView | null> {
  const { data: eventId } = await supabase.rpc("pick_daily_event", { p_user_id: userId });
  if (!eventId) {
    Sentry.captureMessage("daily_event_pool_empty", "error");
    return null;
  }

  const [{ data: event }, { data: outcome }] = await Promise.all([
    supabase
      .from("daily_events_catalog")
      .select("title, narrative, option_a, option_b")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("daily_event_outcomes")
      .select("choice, outcome_json")
      .eq("user_id", userId)
      .eq("resolved_on", todayUtc)
      .maybeSingle(),
  ]);

  const a = parseOption(event?.option_a);
  const b = parseOption(event?.option_b);
  if (!event || !a || !b) {
    Sentry.captureMessage(`daily_event_malformed: ${eventId}`, "error");
    return null;
  }

  const rawChoice = outcome?.choice;
  const choice: "a" | "b" | null = rawChoice === "a" || rawChoice === "b" ? rawChoice : null;
  const resolvedOutcome = parseOption(outcome?.outcome_json);
  const resolved = choice && resolvedOutcome ? { choice, outcome: resolvedOutcome } : null;

  return { title: event.title, narrative: event.narrative, options: { a, b }, resolved };
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
